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
		return f"{self.user} - {self.match.match_name} ({self.status})"
