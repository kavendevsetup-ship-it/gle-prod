from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from payments.models import AdminAccessOverride, MatchPurchase, UserSubscription
from users.models import User

from .models import Match


class AnalyticsDashboardTests(TestCase):
	def setUp(self):
		super().setUp()
		self.superuser = User.objects.create_superuser(
			email="admin@example.com",
			username="admin",
			password="StrongPassword123",
		)
		self.client.force_login(self.superuser)

		self.match = Match.objects.create(
			team_1="India",
			team_2="Australia",
			match_name="India vs Australia",
			match_date=timezone.now() + timedelta(days=1),
		)

		self.override_active_user = User.objects.create_user(
			email="override-active@example.com",
			username="overrideactive",
			password="StrongPassword123",
		)
		self.weekly_subscription_user = User.objects.create_user(
			email="weekly-sub@example.com",
			username="weeklysub",
			password="StrongPassword123",
		)
		self.monthly_subscription_user = User.objects.create_user(
			email="monthly-sub@example.com",
			username="monthlysub",
			password="StrongPassword123",
		)
		self.revoked_override_user = User.objects.create_user(
			email="override-revoked@example.com",
			username="overriderevoked",
			password="StrongPassword123",
		)

		now = timezone.now()

		AdminAccessOverride.objects.create(
			user=self.override_active_user,
			is_active=True,
			plan_type=AdminAccessOverride.PlanType.MONTHLY,
			start_date=now,
			end_date=now + timedelta(days=25),
			notes="Support grant",
		)

		UserSubscription.objects.create(
			user=self.weekly_subscription_user,
			plan_type=UserSubscription.PlanType.WEEKLY,
			start_date=now - timedelta(days=1),
			end_date=now + timedelta(days=6),
			is_active=True,
			last_payment_id="pay_w_1",
		)

		UserSubscription.objects.create(
			user=self.monthly_subscription_user,
			plan_type=UserSubscription.PlanType.MONTHLY,
			start_date=now - timedelta(days=3),
			end_date=now + timedelta(days=27),
			is_active=True,
			last_payment_id="pay_m_1",
		)

		UserSubscription.objects.create(
			user=self.revoked_override_user,
			plan_type=UserSubscription.PlanType.MONTHLY,
			start_date=now - timedelta(days=2),
			end_date=now + timedelta(days=15),
			is_active=True,
			last_payment_id="pay_m_2",
		)
		AdminAccessOverride.objects.create(
			user=self.revoked_override_user,
			is_active=False,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			start_date=now - timedelta(days=2),
			end_date=now + timedelta(days=15),
			notes="Manual revoke",
		)

		MatchPurchase.objects.create(
			user=self.weekly_subscription_user,
			match=None,
			is_subscription=True,
			subscription_start=now - timedelta(days=1),
			subscription_end=now + timedelta(days=6),
			payment_id="payment_success_1",
			amount=Decimal("129.00"),
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		)
		MatchPurchase.objects.create(
			user=self.monthly_subscription_user,
			match=None,
			is_subscription=True,
			subscription_start=now - timedelta(days=2),
			subscription_end=now + timedelta(days=20),
			payment_id="payment_success_2",
			amount=Decimal("499.00"),
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		)
		MatchPurchase.objects.create(
			user=self.weekly_subscription_user,
			match=self.match,
			is_subscription=False,
			payment_id="payment_failed_1",
			amount=Decimal("39.00"),
			status=MatchPurchase.PurchaseStatus.FAILED,
		)

	def test_dashboard_loads_with_live_analytics_and_premium_rows(self):
		response = self.client.get(reverse("admin:analytics-dashboard"))
		self.assertEqual(response.status_code, 200)

		self.assertEqual(response.context["total_revenue"], Decimal("628"))
		self.assertEqual(response.context["active_subscriptions"], 3)
		self.assertEqual(response.context["valid_subscriptions"], 3)
		self.assertGreaterEqual(response.context["total_users"], 5)

		rows = response.context["premium_users_overview"]
		rows_by_email = {row["email"]: row for row in rows}

		self.assertIn("override-active@example.com", rows_by_email)
		self.assertEqual(rows_by_email["override-active@example.com"]["plan_type"], "Override")
		self.assertEqual(rows_by_email["override-active@example.com"]["status"], "Active")

		self.assertIn("weekly-sub@example.com", rows_by_email)
		self.assertEqual(rows_by_email["weekly-sub@example.com"]["plan_type"], "Weekly")
		self.assertEqual(rows_by_email["weekly-sub@example.com"]["status"], "Active")

		self.assertIn("override-revoked@example.com", rows_by_email)
		self.assertEqual(rows_by_email["override-revoked@example.com"]["plan_type"], "Override")
		self.assertEqual(rows_by_email["override-revoked@example.com"]["status"], "Expired")

	def test_premium_filters_and_search_work(self):
		active_response = self.client.get(
			reverse("admin:analytics-dashboard"),
			{"premium_status": "active"},
		)
		self.assertEqual(active_response.status_code, 200)
		for row in active_response.context["premium_users_overview"]:
			self.assertTrue(row["is_active"])

		weekly_response = self.client.get(
			reverse("admin:analytics-dashboard"),
			{"premium_plan": "weekly"},
		)
		self.assertEqual(weekly_response.status_code, 200)
		for row in weekly_response.context["premium_users_overview"]:
			self.assertEqual(row["plan_type"], "Weekly")

		search_response = self.client.get(
			reverse("admin:analytics-dashboard"),
			{"premium_search": "monthly-sub"},
		)
		self.assertEqual(search_response.status_code, 200)
		searched_rows = search_response.context["premium_users_overview"]
		self.assertEqual(len(searched_rows), 1)
		self.assertEqual(searched_rows[0]["email"], "monthly-sub@example.com")

	def test_dashboard_requires_superuser(self):
		normal_user = User.objects.create_user(
			email="normal@example.com",
			username="normaluser",
			password="StrongPassword123",
			is_staff=True,
		)
		self.client.force_login(normal_user)

		response = self.client.get(reverse("admin:analytics-dashboard"))
		self.assertEqual(response.status_code, 403)
