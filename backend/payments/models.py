from django.conf import settings
from django.db import models
from django.db import transaction

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


class PricingConfig(models.Model):
	match_price = models.IntegerField(
		default=3900,
		help_text="Price per match in paise (3900 = ₹39)",
	)
	monthly_price = models.IntegerField(
		default=49900,
		help_text="Monthly price in paise (49900 = ₹499)",
	)
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
		return f"{status} config: match {self.match_price} paise, monthly {self.monthly_price} paise"
