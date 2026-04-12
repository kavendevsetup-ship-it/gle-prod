from datetime import timedelta
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.test import TestCase
from django.test.client import RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient

from matches.models import Match
from users.models import User

from .admin import AdminAccessOverrideAdmin
from .access import get_user_access_state, has_payment_without_subscription_inconsistency
from .models import AdminAccessOverride, MatchPurchase, ProcessedPayment, UserSubscription


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


class AdminAccessOverrideFlowTests(TestCase):
	def setUp(self):
		super().setUp()
		self.client = APIClient()
		self.user = User.objects.create_user(
			email="override@example.com",
			username="overrideuser",
			password="StrongPassword123",
		)
		self.client.force_authenticate(user=self.user)
		self.match = Match.objects.create(
			team_1="India",
			team_2="England",
			match_name="India vs England",
			match_date=timezone.now() + timedelta(days=2),
		)

		self.admin_site = AdminSite()
		self.override_admin = AdminAccessOverrideAdmin(AdminAccessOverride, self.admin_site)
		self.override_admin.message_user = lambda *args, **kwargs: None
		self.admin_request = RequestFactory().post("/admin/payments/adminaccessoverride/")
		self.admin_request.user = self.user

	def _access_response(self):
		return self.client.get(f"/api/access/?match_id={self.match.id}")

	def test_user_without_payment_admin_grants_weekly_access(self):
		override = AdminAccessOverride.objects.create(
			user=self.user,
			is_active=False,
			notes="Manual unlock",
		)

		queryset = AdminAccessOverride.objects.filter(pk=override.pk)
		self.override_admin.grant_weekly_access(self.admin_request, queryset)

		override.refresh_from_db()
		self.assertTrue(override.is_active)
		self.assertEqual(override.plan_type, AdminAccessOverride.PlanType.WEEKLY)
		self.assertIsNotNone(override.end_date)
		self.assertGreater(override.end_date, timezone.now())

		response = self._access_response()
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("has_access"))

	def test_paid_user_admin_revoke_removes_access(self):
		UserSubscription.objects.create(
			user=self.user,
			plan_type=UserSubscription.PlanType.MONTHLY,
			start_date=timezone.now() - timedelta(days=2),
			end_date=timezone.now() + timedelta(days=20),
			is_active=True,
			last_payment_id="pay_sub_1",
		)

		override = AdminAccessOverride.objects.create(
			user=self.user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			notes="Temporary trial",
		)

		queryset = AdminAccessOverride.objects.filter(pk=override.pk)
		self.override_admin.revoke_access(self.admin_request, queryset)

		response = self._access_response()
		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data.get("has_access"))

	def test_paid_user_admin_extend_access_duration(self):
		UserSubscription.objects.create(
			user=self.user,
			plan_type=UserSubscription.PlanType.WEEKLY,
			start_date=timezone.now() - timedelta(days=1),
			end_date=timezone.now() + timedelta(days=6),
			is_active=True,
			last_payment_id="pay_sub_2",
		)

		override = AdminAccessOverride.objects.create(
			user=self.user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			start_date=timezone.now() - timedelta(days=1),
			end_date=timezone.now() + timedelta(days=3),
			notes="Need extension",
		)

		previous_end = override.end_date
		queryset = AdminAccessOverride.objects.filter(pk=override.pk)
		self.override_admin.grant_monthly_access(self.admin_request, queryset)

		override.refresh_from_db()
		self.assertTrue(override.is_active)
		self.assertEqual(override.plan_type, AdminAccessOverride.PlanType.MONTHLY)
		self.assertIsNotNone(previous_end)
		self.assertGreater(override.end_date, previous_end)

		response = self._access_response()
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("has_access"))

	def test_override_expiry_falls_back_to_subscription(self):
		UserSubscription.objects.create(
			user=self.user,
			plan_type=UserSubscription.PlanType.MONTHLY,
			start_date=timezone.now() - timedelta(days=5),
			end_date=timezone.now() + timedelta(days=10),
			is_active=True,
			last_payment_id="pay_sub_3",
		)

		AdminAccessOverride.objects.create(
			user=self.user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			start_date=timezone.now() - timedelta(days=10),
			end_date=timezone.now() - timedelta(minutes=1),
			notes="Expired override",
		)

		response = self._access_response()
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data.get("has_access"))

	def test_no_override_and_no_subscription_means_access_locked(self):
		response = self._access_response()
		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data.get("has_access"))


class AccessStateSyncServiceTests(TestCase):
	def setUp(self):
		super().setUp()
		self.user = User.objects.create_user(
			email="state-sync@example.com",
			username="statesync",
			password="StrongPassword123",
		)

	def test_get_user_access_state_prefers_active_override(self):
		now = timezone.now()
		UserSubscription.objects.create(
			user=self.user,
			plan_type=UserSubscription.PlanType.MONTHLY,
			start_date=now - timedelta(days=1),
			end_date=now + timedelta(days=10),
			is_active=True,
			last_payment_id="sub_state_1",
		)
		AdminAccessOverride.objects.create(
			user=self.user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			start_date=now,
			end_date=now + timedelta(days=3),
		)

		state = get_user_access_state(self.user)
		self.assertTrue(state["has_access"])
		self.assertEqual(state["source"], "override")
		self.assertEqual(state["plan_type"], "weekly")

	def test_expired_active_override_is_auto_corrected(self):
		now = timezone.now()
		override = AdminAccessOverride.objects.create(
			user=self.user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			start_date=now - timedelta(days=3),
			end_date=now - timedelta(minutes=1),
		)

		state = get_user_access_state(self.user)
		override.refresh_from_db()

		self.assertFalse(state["has_access"])
		self.assertEqual(state["source"], "override")
		self.assertFalse(override.is_active)

	def test_inconsistency_flag_detects_subscription_payment_without_subscription_record(self):
		MatchPurchase.objects.create(
			user=self.user,
			match=None,
			is_subscription=True,
			subscription_start=timezone.now() - timedelta(days=1),
			subscription_end=timezone.now() + timedelta(days=6),
			payment_id="inconsistency_pay_1",
			amount="129.00",
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		)

		self.assertTrue(has_payment_without_subscription_inconsistency(self.user))
