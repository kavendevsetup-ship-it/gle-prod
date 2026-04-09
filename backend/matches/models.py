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
		TEXT = "text", "Text"

	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="free_contents",
		verbose_name="Match",
	)
	file = models.FileField("File", upload_to="free_content/", null=True, blank=True)
	type = models.CharField(
		"Type",
		max_length=10,
		choices=ContentType.choices,
		default=ContentType.PDF,
	)
	content_type = models.CharField(
		"Content Type",
		max_length=10,
		choices=ContentType.choices,
		default=ContentType.PDF,
	)
	text_title = models.CharField("Text Title", max_length=255, null=True, blank=True)
	text_body = models.TextField("Text Body", null=True, blank=True)
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Free Content"
		verbose_name_plural = "Free Content"

	def __str__(self) -> str:
		if self.content_type == self.ContentType.TEXT and self.text_title:
			label = self.text_title
		else:
			label = self.get_content_type_display()
		return f"{self.match.match_name} - {label}"


class PremiumContent(models.Model):
	class ContentType(models.TextChoices):
		TEXT = "text", "Text"
		IMAGE = "image", "Image"
		VIDEO = "video", "Video"

	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="premium_contents",
		verbose_name="Match",
	)
	content_type = models.CharField(
		"Content Type",
		max_length=10,
		choices=ContentType.choices,
		default=ContentType.TEXT,
	)
	title = models.CharField("Title", max_length=255, blank=True, default="")
	description = models.TextField("Expert Analysis", blank=True, default="")
	image = models.ImageField(
		"Image",
		upload_to="premium_content/",
		null=True,
		blank=True,
	)
	video = models.FileField(
		"Video",
		upload_to="premium_videos/",
		null=True,
		blank=True,
	)
	created_at = models.DateTimeField("Created At", auto_now_add=True)

	class Meta:
		verbose_name = "Premium Content"
		verbose_name_plural = "Premium Content"

	def __str__(self) -> str:
		label = self.title or self.get_content_type_display()
		return f"{self.match.match_name} - {label}"
