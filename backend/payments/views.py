import logging
import os
import uuid
from datetime import timedelta

import razorpay
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.models import Match

from .access import has_active_premium_access, has_active_subscription, has_premium_access
from .models import MatchPurchase


PLAN_MATCH = "match"
PLAN_SUBSCRIPTION = "subscription"
MATCH_PRICE_INR = 39
MATCH_PRICE_PAISE = 3900
SUBSCRIPTION_PRICE_INR = 399
SUBSCRIPTION_PRICE_PAISE = 39900

logger = logging.getLogger(__name__)


def _get_razorpay_client() -> razorpay.Client:
	key_id = os.getenv("RAZORPAY_KEY_ID", "")
	key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
	return razorpay.Client(auth=(key_id, key_secret))


def _parse_plan_type(raw_value) -> str | None:
	plan_type = str(raw_value or PLAN_MATCH).strip().lower()
	if plan_type not in {PLAN_MATCH, PLAN_SUBSCRIPTION}:
		return None
	return plan_type


class CreateOrderAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		plan_type = _parse_plan_type(request.data.get("type"))
		if plan_type is None:
			return Response({"detail": "type must be 'match' or 'subscription'"}, status=400)

		match = None
		amount_paise = SUBSCRIPTION_PRICE_PAISE
		receipt = f"sub-{request.user.id}-{uuid.uuid4().hex[:10]}"

		if plan_type == PLAN_MATCH:
			match_id = request.data.get("match_id")
			if not match_id:
				return Response({"detail": "match_id is required for type='match'"}, status=400)

			match = get_object_or_404(Match, pk=match_id)
			amount_paise = MATCH_PRICE_PAISE
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
			return Response({"detail": "type must be 'match' or 'subscription'"}, status=400)

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

		try:
			client.utility.verify_payment_signature(
				{
					"razorpay_order_id": razorpay_order_id,
					"razorpay_payment_id": razorpay_payment_id,
					"razorpay_signature": razorpay_signature,
				}
			)
		except razorpay.errors.SignatureVerificationError:
			return Response({"detail": "Payment verification failed"}, status=400)

		already_recorded = MatchPurchase.objects.filter(
			user=request.user,
			payment_id=razorpay_payment_id,
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		).exists()

		if not already_recorded:
			if plan_type == PLAN_SUBSCRIPTION:
				subscription_start = timezone.now()
				subscription_end = subscription_start + timedelta(days=30)

				MatchPurchase.objects.create(
					user=request.user,
					match=None,
					is_subscription=True,
					subscription_start=subscription_start,
					subscription_end=subscription_end,
					payment_id=razorpay_payment_id,
					amount=SUBSCRIPTION_PRICE_INR,
					status=MatchPurchase.PurchaseStatus.SUCCESS,
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
						amount=MATCH_PRICE_INR,
						status=MatchPurchase.PurchaseStatus.SUCCESS,
					)

		is_subscription_active = has_active_subscription(request.user)
		has_access = (
			has_premium_access(request.user, match)
			if match
			else has_active_premium_access(request.user)
		)

		return Response(
			{
				"success": True,
				"type": plan_type,
				"has_access": has_access,
				"is_subscription": is_subscription_active,
				"access": has_access,
			}
		)


class CheckAccessAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		match_id = request.query_params.get("match_id")
		if not match_id:
			return Response({"detail": "match_id is required"}, status=400)

		match = get_object_or_404(Match, pk=match_id)
		is_subscription_active = has_active_subscription(request.user)
		has_access = has_premium_access(request.user, match)

		return Response(
			{
				"has_access": has_access,
				"is_subscription": is_subscription_active,
				"access": has_access,
			}
		)
