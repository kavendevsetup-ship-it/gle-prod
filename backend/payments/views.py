import os
import uuid
import logging

import razorpay
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.models import Match

from .models import MatchPurchase


PRICE_INR = 299
PRICE_PAISE = 29900

logger = logging.getLogger(__name__)


def _get_razorpay_client() -> razorpay.Client:
	key_id = os.getenv("RAZORPAY_KEY_ID", "")
	key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
	return razorpay.Client(auth=(key_id, key_secret))


class CreateOrderAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		match_id = request.data.get("match_id")
		if not match_id:
			return Response({"detail": "match_id is required"}, status=400)

		match = get_object_or_404(Match, pk=match_id)

		key_id = os.getenv("RAZORPAY_KEY_ID", "")
		key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
		if not key_id or not key_secret:
			return Response(
				{"detail": "Razorpay credentials are not configured"},
				status=500,
			)

		client = _get_razorpay_client()
		receipt = f"match-{match.id}-{uuid.uuid4().hex[:10]}"

		try:
			order = client.order.create(
				{
					"amount": PRICE_PAISE,
					"currency": "INR",
					"receipt": receipt,
				}
			)
		except Exception as exc:
			masked_key = f"{key_id[:6]}...{key_id[-4:]}" if key_id else "None"
			print(f"RAZORPAY ERROR: {str(exc)}")
			logger.exception(
				"Create order failed for match_id=%s using key=%s",
				match.id,
				masked_key,
			)
			return Response({"error": str(exc)}, status=500)

		return Response(
			{
				"order_id": order.get("id"),
				"amount": PRICE_PAISE,
				"currency": "INR",
				"key": key_id,
			}
		)


class VerifyPaymentAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		razorpay_order_id = request.data.get("razorpay_order_id")
		razorpay_payment_id = request.data.get("razorpay_payment_id")
		razorpay_signature = request.data.get("razorpay_signature")
		match_id = request.data.get("match_id")

		if not all(
			[razorpay_order_id, razorpay_payment_id, razorpay_signature, match_id]
		):
			return Response(
				{
					"detail": (
						"razorpay_order_id, razorpay_payment_id, "
						"razorpay_signature, and match_id are required"
					)
				},
				status=400,
			)

		match = get_object_or_404(Match, pk=match_id)

		key_id = os.getenv("RAZORPAY_KEY_ID", "")
		key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
		if not key_id or not key_secret:
			return Response(
				{"detail": "Razorpay credentials are not configured"},
				status=500,
			)

		client = _get_razorpay_client()

		# Signature verification (mandatory security check)
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

		# Prevent duplicate successful purchase records
		already_purchased = MatchPurchase.objects.filter(
			user=request.user,
			match=match,
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		).exists()

		if not already_purchased:
			MatchPurchase.objects.create(
				user=request.user,
				match=match,
				payment_id=razorpay_payment_id,
				amount=PRICE_INR,
				status=MatchPurchase.PurchaseStatus.SUCCESS,
			)

		return Response({"success": True})
