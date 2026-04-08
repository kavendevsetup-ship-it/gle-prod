from django.conf import settings
from django.db import models

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
