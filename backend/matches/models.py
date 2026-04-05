from django.db import models


class Match(models.Model):
	team_1 = models.CharField("Team 1", max_length=120)
	team_2 = models.CharField("Team 2", max_length=120)
	match_name = models.CharField("Match Name", max_length=255)
	match_date = models.DateTimeField("Match Date")
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		ordering = ["-match_date"]
		verbose_name = "Match"
		verbose_name_plural = "Matches"

	def __str__(self) -> str:
		return self.match_name


class FreeContent(models.Model):
	class ContentType(models.TextChoices):
		PDF = "pdf", "PDF"
		IMAGE = "image", "Image"

	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="free_contents",
		verbose_name="Match",
	)
	file = models.FileField("File", upload_to="free_content/")
	type = models.CharField("Type", max_length=10, choices=ContentType.choices)
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Free Content"
		verbose_name_plural = "Free Content"

	def __str__(self) -> str:
		return f"{self.match.match_name} - {self.get_type_display()}"


class PremiumContent(models.Model):
	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="premium_contents",
		verbose_name="Match",
	)
	title = models.CharField("Title", max_length=255)
	description = models.TextField("Expert Analysis")
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Premium Content"
		verbose_name_plural = "Premium Content"

	def __str__(self) -> str:
		return f"{self.match.match_name} - {self.title}"
