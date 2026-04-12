from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from matches.models import Match
from users.models import User

from .models import MatchPurchase, ProcessedPayment, UserSubscription


class _FakeRazorpayClient:
	class utility:
		@staticmethod
		def verify_payment_signature(_payload):
			return True


class PaymentVerificationFlowTests(TestCase):
	def setUp(self):
		super().setUp()
		self.client = APIClient()
		self.user = User.objects.create_user(
			email="test@example.com",
			username="testuser",
			password="StrongPassword123",
		)
		self.client.force_authenticate(user=self.user)
		self.match = Match.objects.create(
			team_1="India",
			team_2="Australia",
			match_name="India vs Australia",
			match_date=timezone.now() + timedelta(days=1),
		)

		self._env_patch = patch.dict(
			"os.environ",
			{
				"RAZORPAY_KEY_ID": "test_key",
				"RAZORPAY_KEY_SECRET": "test_secret",
			},
		)
		self._env_patch.start()

	def tearDown(self):
		self._env_patch.stop()
		super().tearDown()

	def _verify(self, *, payment_id: str, order_id: str, plan_type: str, match_id: int | None = None):
		payload = {
			"razorpay_order_id": order_id,
			"razorpay_payment_id": payment_id,
			"razorpay_signature": "valid_signature",
			"type": plan_type,
		}
		if match_id is not None:
			payload["match_id"] = match_id

		with patch("payments.views._get_razorpay_client", return_value=_FakeRazorpayClient()):
			return self.client.post("/api/payment/verify/", payload, format="json")

	def test_weekly_plan_unlocks_access_for_7_days(self):
		response = self._verify(
			payment_id="pay_weekly_1",
			order_id="order_weekly_1",
			plan_type="weekly",
		)

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("success"))
		self.assertTrue(response.data.get("has_access"))
		self.assertTrue(response.data.get("is_subscription"))

		subscription = UserSubscription.objects.get(user=self.user)
		self.assertEqual(subscription.plan_type, UserSubscription.PlanType.WEEKLY)
		self.assertTrue(subscription.is_active)

		expected_end = timezone.now() + timedelta(days=7)
		self.assertLess(abs((subscription.end_date - expected_end).total_seconds()), 10)

	def test_monthly_plan_unlocks_access_for_30_days(self):
		response = self._verify(
			payment_id="pay_monthly_1",
			order_id="order_monthly_1",
			plan_type="subscription",
		)

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("success"))
		self.assertTrue(response.data.get("has_access"))

		subscription = UserSubscription.objects.get(user=self.user)
		self.assertEqual(subscription.plan_type, UserSubscription.PlanType.MONTHLY)

		expected_end = timezone.now() + timedelta(days=30)
		self.assertLess(abs((subscription.end_date - expected_end).total_seconds()), 10)

	def test_repeat_purchase_extends_existing_active_subscription(self):
		start = timezone.now() - timedelta(days=1)
		existing_end = timezone.now() + timedelta(days=5)
		UserSubscription.objects.create(
			user=self.user,
			plan_type=UserSubscription.PlanType.WEEKLY,
			start_date=start,
			end_date=existing_end,
			is_active=True,
			last_payment_id="old_payment",
		)

		response = self._verify(
			payment_id="pay_monthly_extend",
			order_id="order_monthly_extend",
			plan_type="subscription",
		)

		self.assertEqual(response.status_code, 200)
		subscription = UserSubscription.objects.get(user=self.user)
		expected_end = existing_end + timedelta(days=30)
		self.assertLess(abs((subscription.end_date - expected_end).total_seconds()), 10)

	def test_duplicate_verify_callback_is_idempotent(self):
		first_response = self._verify(
			payment_id="pay_dupe_1",
			order_id="order_dupe_1",
			plan_type="weekly",
		)
		second_response = self._verify(
			payment_id="pay_dupe_1",
			order_id="order_dupe_1",
			plan_type="weekly",
		)

		self.assertEqual(first_response.status_code, 200)
		self.assertEqual(second_response.status_code, 200)
		self.assertTrue(second_response.data.get("idempotent"))
		self.assertEqual(
			ProcessedPayment.objects.filter(payment_id="pay_dupe_1").count(),
			1,
		)
		self.assertEqual(
			MatchPurchase.objects.filter(payment_id="pay_dupe_1").count(),
			1,
		)

	def test_access_endpoint_stays_active_after_payment(self):
		self._verify(
			payment_id="pay_access_1",
			order_id="order_access_1",
			plan_type="weekly",
		)

		response = self.client.get(f"/api/access/?match_id={self.match.id}")
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("has_access"))
		self.assertTrue(response.data.get("is_subscription"))

	def test_atomic_rolls_back_processed_marker_on_db_failure(self):
		with patch("payments.views._get_razorpay_client", return_value=_FakeRazorpayClient()):
			with patch("payments.views.MatchPurchase.objects.create", side_effect=RuntimeError("db failure")):
				response = self.client.post(
					"/api/payment/verify/",
					{
						"razorpay_order_id": "order_atomic_1",
						"razorpay_payment_id": "pay_atomic_1",
						"razorpay_signature": "valid_signature",
						"type": "weekly",
					},
					format="json",
				)

		self.assertEqual(response.status_code, 500)
		self.assertTrue(response.data.get("activation_pending"))
		self.assertFalse(ProcessedPayment.objects.filter(payment_id="pay_atomic_1").exists())
