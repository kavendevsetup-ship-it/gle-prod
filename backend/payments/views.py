import logging
import os
import uuid
from decimal import Decimal
from datetime import timedelta

import razorpay
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.models import Match

from .access import (
	get_active_subscription_end,
	has_active_premium_access,
	has_active_subscription,
	has_premium_access,
)
from .models import MatchPurchase, ProcessedPayment, UserSubscription
from .pricing import get_active_pricing


PLAN_MATCH = "match"
PLAN_SUBSCRIPTION = "subscription"
PLAN_WEEKLY = "weekly"

logger = logging.getLogger(__name__)

SUBSCRIPTION_DAYS = {
	PLAN_WEEKLY: 7,
	PLAN_SUBSCRIPTION: 30,
}


def _get_razorpay_client() -> razorpay.Client:
	key_id = os.getenv("RAZORPAY_KEY_ID", "")
	key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
	return razorpay.Client(auth=(key_id, key_secret))


def _parse_plan_type(raw_value) -> str | None:
	plan_type = str(raw_value or PLAN_MATCH).strip().lower()
	if plan_type not in {PLAN_MATCH, PLAN_SUBSCRIPTION, PLAN_WEEKLY}:
		return None
	return plan_type


def _build_access_payload(user, match: Match | None = None) -> dict[str, object]:
	is_subscription_active = has_active_subscription(user)
	has_access = has_premium_access(user, match) if match else has_active_premium_access(user)
	subscription_end = get_active_subscription_end(user)

	return {
		"has_access": has_access,
		"is_subscription": is_subscription_active,
		"access": has_access,
		"subscription_end": subscription_end.isoformat() if subscription_end else None,
	}


def _apply_subscription_purchase(user, plan_type: str, payment_id: str) -> tuple[timezone.datetime, timezone.datetime]:
	now = timezone.now()
	duration_days = SUBSCRIPTION_DAYS[plan_type]
	plan_for_subscription = (
		UserSubscription.PlanType.WEEKLY
		if plan_type == PLAN_WEEKLY
		else UserSubscription.PlanType.MONTHLY
	)

	try:
		subscription = UserSubscription.objects.select_for_update().get(user=user)
	except UserSubscription.DoesNotExist:
		subscription = None

	if subscription and subscription.is_active and subscription.end_date > now:
		extension_base = subscription.end_date
		start_date = subscription.start_date
	else:
		extension_base = now
		start_date = now

	new_end = extension_base + timedelta(days=duration_days)

	if subscription is None:
		subscription = UserSubscription.objects.create(
			user=user,
			plan_type=plan_for_subscription,
			start_date=start_date,
			end_date=new_end,
			is_active=True,
			last_payment_id=payment_id,
		)
	else:
		subscription.plan_type = plan_for_subscription
		subscription.start_date = start_date
		subscription.end_date = new_end
		subscription.is_active = True
		subscription.last_payment_id = payment_id
		subscription.save(update_fields=("plan_type", "start_date", "end_date", "is_active", "last_payment_id", "updated_at"))

	return extension_base, new_end


class CreateOrderAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		plan_type = _parse_plan_type(request.data.get("type"))
		if plan_type is None:
			return Response({"detail": "type must be 'match', 'weekly', or 'subscription'"}, status=400)

		pricing = get_active_pricing()
		match = None
		amount_paise = pricing.monthly_price
		receipt = f"sub-{request.user.id}-{uuid.uuid4().hex[:10]}"

		if plan_type == PLAN_WEEKLY:
			if not pricing.enable_weekly:
				return Response({"detail": "weekly plan is currently disabled"}, status=400)

			amount_paise = pricing.weekly_price
			receipt = f"weekly-{request.user.id}-{uuid.uuid4().hex[:10]}"

		if plan_type == PLAN_SUBSCRIPTION and not pricing.enable_monthly:
			return Response({"detail": "monthly plan is currently disabled"}, status=400)

		if plan_type == PLAN_MATCH:
			if not pricing.enable_match:
				return Response({"detail": "match plan is currently disabled"}, status=400)

			match_id = request.data.get("match_id")
			if not match_id:
				return Response({"detail": "match_id is required for type='match'"}, status=400)

			match = get_object_or_404(Match, pk=match_id)
			amount_paise = pricing.match_price
			receipt = f"match-{match.id}-{uuid.uuid4().hex[:10]}"

		key_id = os.getenv("RAZORPAY_KEY_ID", "")
		key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
		if not key_id or not key_secret:
			return Response(
				{"detail": "Razorpay credentials are not configured"},
				status=500,
			)

		client = _get_razorpay_client()

		try:
			order = client.order.create(
				{
					"amount": amount_paise,
					"currency": "INR",
					"receipt": receipt,
				}
			)
		except Exception as exc:
			masked_key = f"{key_id[:6]}...{key_id[-4:]}" if key_id else "None"
			logger.exception(
				"Create order failed for plan_type=%s match_id=%s using key=%s",
				plan_type,
				match.id if match else None,
				masked_key,
			)
			return Response({"error": str(exc)}, status=500)

		response_payload = {
			"order_id": order.get("id"),
			"amount": amount_paise,
			"currency": "INR",
			"key": key_id,
			"type": plan_type,
		}
		if match is not None:
			response_payload["match_id"] = match.id

		return Response(response_payload)


class VerifyPaymentAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		razorpay_order_id = request.data.get("razorpay_order_id")
		razorpay_payment_id = request.data.get("razorpay_payment_id")
		razorpay_signature = request.data.get("razorpay_signature")
		plan_type = _parse_plan_type(request.data.get("type"))

		if plan_type is None:
			return Response({"detail": "type must be 'match', 'weekly', or 'subscription'"}, status=400)

		if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
			return Response(
				{
					"detail": (
						"razorpay_order_id, razorpay_payment_id, "
						"and razorpay_signature are required"
					)
				},
				status=400,
			)

		match = None
		if plan_type == PLAN_MATCH:
			match_id = request.data.get("match_id")
			if not match_id:
				return Response({"detail": "match_id is required for type='match'"}, status=400)
			match = get_object_or_404(Match, pk=match_id)

		key_id = os.getenv("RAZORPAY_KEY_ID", "")
		key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
		if not key_id or not key_secret:
			return Response(
				{"detail": "Razorpay credentials are not configured"},
				status=500,
			)

		client = _get_razorpay_client()
		logger.info(
			"payment.received user_id=%s payment_id=%s order_id=%s plan_type=%s match_id=%s",
			request.user.id,
			razorpay_payment_id,
			razorpay_order_id,
			plan_type,
			match.id if match else None,
		)

		try:
			with transaction.atomic():
				client.utility.verify_payment_signature(
					{
						"razorpay_order_id": razorpay_order_id,
						"razorpay_payment_id": razorpay_payment_id,
						"razorpay_signature": razorpay_signature,
					}
				)
				logger.info(
					"payment.signature_verified user_id=%s payment_id=%s order_id=%s",
					request.user.id,
					razorpay_payment_id,
					razorpay_order_id,
				)

				processed_payment, created = ProcessedPayment.objects.get_or_create(
					payment_id=razorpay_payment_id,
					defaults={
						"order_id": razorpay_order_id,
						"user": request.user,
						"plan_type": plan_type,
						"match": match,
					},
				)

				if not created:
					logger.info(
						"payment.duplicate_callback user_id=%s payment_id=%s existing_user_id=%s",
						request.user.id,
						razorpay_payment_id,
						processed_payment.user_id,
					)
					access_payload = _build_access_payload(request.user, match)
					return Response(
						{
							"success": True,
							"type": plan_type,
							"idempotent": True,
							**access_payload,
						}
					)

				pricing = get_active_pricing()
				weekly_price_inr = Decimal(pricing.weekly_price) / Decimal("100")
				monthly_price_inr = Decimal(pricing.monthly_price) / Decimal("100")
				match_price_inr = Decimal(pricing.match_price) / Decimal("100")

				if plan_type in {PLAN_SUBSCRIPTION, PLAN_WEEKLY}:
					subscription_amount = (
						weekly_price_inr if plan_type == PLAN_WEEKLY else monthly_price_inr
					)
					subscription_start, subscription_end = _apply_subscription_purchase(
						request.user,
						plan_type,
						razorpay_payment_id,
					)

					MatchPurchase.objects.create(
						user=request.user,
						match=None,
						is_subscription=True,
						subscription_start=subscription_start,
						subscription_end=subscription_end,
						payment_id=razorpay_payment_id,
						amount=subscription_amount,
						status=MatchPurchase.PurchaseStatus.SUCCESS,
					)
					logger.info(
						"payment.subscription_applied user_id=%s payment_id=%s plan_type=%s start=%s end=%s",
						request.user.id,
						razorpay_payment_id,
						plan_type,
						subscription_start,
						subscription_end,
					)
				else:
					already_purchased_match = MatchPurchase.objects.filter(
						user=request.user,
						match=match,
						is_subscription=False,
						status=MatchPurchase.PurchaseStatus.SUCCESS,
					).exists()

					if not already_purchased_match:
						MatchPurchase.objects.create(
							user=request.user,
							match=match,
							is_subscription=False,
							subscription_start=None,
							subscription_end=None,
							payment_id=razorpay_payment_id,
							amount=match_price_inr,
							status=MatchPurchase.PurchaseStatus.SUCCESS,
						)
						logger.info(
							"payment.match_access_granted user_id=%s payment_id=%s match_id=%s",
							request.user.id,
							razorpay_payment_id,
							match.id if match else None,
						)

		except razorpay.errors.SignatureVerificationError:
			logger.warning(
				"payment.signature_failed user_id=%s payment_id=%s order_id=%s",
				request.user.id,
				razorpay_payment_id,
				razorpay_order_id,
			)
			return Response({"detail": "Payment verification failed"}, status=400)
		except IntegrityError:
			logger.info(
				"payment.idempotency_race user_id=%s payment_id=%s",
				request.user.id,
				razorpay_payment_id,
			)
		except Exception:
			logger.exception(
				"payment.processing_failed user_id=%s payment_id=%s order_id=%s plan_type=%s",
				request.user.id,
				razorpay_payment_id,
				razorpay_order_id,
				plan_type,
			)
			return Response(
				{
					"success": False,
					"type": plan_type,
					"activation_pending": True,
					"message": "Payment received. Activating access...",
					"detail": "Payment verified but activation is delayed. Please retry access check.",
					"has_access": False,
					"access": False,
					"is_subscription": False,
					"subscription_end": None,
				},
				status=500,
			)

		access_payload = _build_access_payload(request.user, match)
		if access_payload["has_access"]:
			logger.info(
				"payment.access_granted user_id=%s payment_id=%s has_access=%s",
				request.user.id,
				razorpay_payment_id,
				access_payload["has_access"],
			)
			return Response(
				{
					"success": True,
					"type": plan_type,
					"activation_pending": False,
					"message": "Access activated",
					**access_payload,
				}
			)

		logger.error(
			"payment.access_not_active_after_verification user_id=%s payment_id=%s order_id=%s plan_type=%s",
			request.user.id,
			razorpay_payment_id,
			razorpay_order_id,
			plan_type,
		)
		return Response(
			{
				"success": True,
				"type": plan_type,
				"activation_pending": True,
				"message": "Payment received. Activating access...",
				**access_payload,
			},
			status=202,
		)


class AccessStatusAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		match_id = request.query_params.get("match_id")
		match = None
		if match_id:
			match = get_object_or_404(Match, pk=match_id)

		return Response(_build_access_payload(request.user, match))


class CheckAccessAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		match_id = request.query_params.get("match_id")
		if not match_id:
			return Response({"detail": "match_id is required"}, status=400)

		match = get_object_or_404(Match, pk=match_id)
		return Response(_build_access_payload(request.user, match))


class PricingAPIView(APIView):
	def get(self, request):
		pricing = get_active_pricing()
		return Response(
			{
				"match_price": pricing.match_price // 100,
				"weekly_price": pricing.weekly_price // 100,
				"weekly_original_price": pricing.weekly_original_price // 100,
				"monthly_price": pricing.monthly_price // 100,
				"monthly_original_price": pricing.monthly_original_price // 100,
				"enable_weekly": pricing.enable_weekly,
				"enable_monthly": pricing.enable_monthly,
				"enable_match": pricing.enable_match,
				"weekly_offer_active": pricing.weekly_offer_active,
				"monthly_offer_active": pricing.monthly_offer_active,
				"enable_match_plan": pricing.enable_match,
			}
		)
