from django.conf import settings
from django.db import models
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from matches.models import Match


class MatchPurchase(models.Model):
	class PurchaseStatus(models.TextChoices):
		SUCCESS = "success", "Success"
		PENDING = "pending", "Pending"
		FAILED = "failed", "Failed"

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="match_purchases",
		verbose_name="User",
	)
	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="purchases",
		verbose_name="Match",
		null=True,
		blank=True,
	)
	is_subscription = models.BooleanField("Is Subscription", default=False)
	subscription_start = models.DateTimeField(
		"Subscription Start",
		null=True,
		blank=True,
	)
	subscription_end = models.DateTimeField(
		"Subscription End",
		null=True,
		blank=True,
		db_index=True,
	)
	payment_id = models.CharField("Payment ID", max_length=128)
	amount = models.DecimalField("Amount", max_digits=10, decimal_places=2)
	status = models.CharField(
		"Status",
		max_length=10,
		choices=PurchaseStatus.choices,
		default=PurchaseStatus.PENDING,
	)
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Match Purchase"
		verbose_name_plural = "Match Purchases"

	def __str__(self) -> str:
		if self.is_subscription:
			return f"{self.user} - Monthly Subscription ({self.status})"

		match_name = self.match.match_name if self.match else "Match"
		return f"{self.user} - {match_name} ({self.status})"


class UserSubscription(models.Model):
	class PlanType(models.TextChoices):
		WEEKLY = "weekly", "Weekly"
		MONTHLY = "subscription", "Monthly"

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="active_subscription",
		verbose_name="User",
	)
	plan_type = models.CharField(
		"Plan Type",
		max_length=20,
		choices=PlanType.choices,
	)
	start_date = models.DateTimeField("Start Date")
	end_date = models.DateTimeField("End Date", db_index=True)
	is_active = models.BooleanField("Is Active", default=True)
	last_payment_id = models.CharField(
		"Last Payment ID",
		max_length=128,
		blank=True,
		default="",
		db_index=True,
	)
	created_at = models.DateTimeField("Created At", auto_now_add=True)
	updated_at = models.DateTimeField("Updated At", auto_now=True)

	class Meta:
		verbose_name = "User Subscription"
		verbose_name_plural = "User Subscriptions"

	def __str__(self) -> str:
		return f"{self.user} - {self.plan_type} until {self.end_date}"


class AdminAccessOverride(models.Model):
	class PlanType(models.TextChoices):
		WEEKLY = "weekly", "Weekly"
		MONTHLY = "monthly", "Monthly"

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="admin_access_overrides",
		verbose_name="User",
	)
	is_active = models.BooleanField(default=False)
	plan_type = models.CharField(
		max_length=20,
		choices=PlanType.choices,
		null=True,
		blank=True,
	)
	start_date = models.DateTimeField(null=True, blank=True)
	end_date = models.DateTimeField(null=True, blank=True, db_index=True)
	notes = models.TextField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = "Admin Access Override"
		verbose_name_plural = "Admin Access Overrides"
		ordering = ("-updated_at", "-id")
		constraints = [
			models.UniqueConstraint(
				fields=("user",),
				condition=Q(is_active=True),
				name="unique_active_admin_access_override_per_user",
			),
		]

	def save(self, *args, **kwargs):
		now = timezone.now()

		if self.is_active:
			if self.start_date is None:
				self.start_date = now

			# Apply duration defaults when no end is provided; explicit end dates are preserved
			# so admin actions can extend existing access without being overwritten.
			if self.end_date is None:
				if self.plan_type == self.PlanType.WEEKLY:
					self.end_date = now + timedelta(days=7)
				elif self.plan_type == self.PlanType.MONTHLY:
					self.end_date = now + timedelta(days=30)

		with transaction.atomic():
			super().save(*args, **kwargs)
			if self.is_active:
				type(self).objects.filter(user=self.user, is_active=True).exclude(pk=self.pk).update(is_active=False)
			else:
				type(self).objects.filter(user=self.user, is_active=True).exclude(pk=self.pk).update(is_active=False)

	def __str__(self) -> str:
		return f"{self.user} - {self.plan_type or 'no-plan'} ({'active' if self.is_active else 'inactive'})"


class ProcessedPayment(models.Model):
	payment_id = models.CharField("Payment ID", max_length=128, unique=True)
	order_id = models.CharField("Order ID", max_length=128, db_index=True)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="processed_payments",
		verbose_name="User",
	)
	plan_type = models.CharField("Plan Type", max_length=20)
	match = models.ForeignKey(
		Match,
		on_delete=models.SET_NULL,
		related_name="processed_payments",
		null=True,
		blank=True,
		verbose_name="Match",
	)
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Processed Payment"
		verbose_name_plural = "Processed Payments"
		ordering = ("-created_at", "-id")

	def __str__(self) -> str:
		return f"{self.payment_id} ({self.plan_type})"


class PricingConfig(models.Model):
	match_price = models.IntegerField(
		default=3900,
		help_text="Price per match in paise (3900 = ₹39)",
	)
	weekly_price = models.IntegerField(
		default=12900,
		help_text="Offer price in paise",
	)
	weekly_original_price = models.IntegerField(
		default=19900,
		help_text="Strikethrough price",
	)
	monthly_price = models.IntegerField(
		default=49900,
		help_text="Monthly price in paise (49900 = ₹499)",
	)
	monthly_original_price = models.IntegerField(
		default=49900,
		help_text="Strikethrough price",
	)
	enable_weekly = models.BooleanField(default=True)
	enable_monthly = models.BooleanField(default=True)
	enable_match = models.BooleanField(default=False)
	weekly_offer_active = models.BooleanField(default=True)
	monthly_offer_active = models.BooleanField(default=False)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		verbose_name = "Pricing Configuration"
		verbose_name_plural = "Pricing Configurations"
		ordering = ("-created_at", "-id")

	def save(self, *args, **kwargs):
		with transaction.atomic():
			super().save(*args, **kwargs)
			if self.is_active:
				type(self).objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)

		from .pricing import clear_active_pricing_cache

		clear_active_pricing_cache()

	def delete(self, *args, **kwargs):
		super().delete(*args, **kwargs)

		from .pricing import clear_active_pricing_cache

		clear_active_pricing_cache()

	def __str__(self) -> str:
		status = "Active" if self.is_active else "Inactive"
		return (
			f"{status} config: match {self.match_price} paise, weekly {self.weekly_price} paise, "
			f"monthly {self.monthly_price} paise"
		)
