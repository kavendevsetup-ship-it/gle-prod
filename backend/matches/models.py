from django.core.exceptions import ValidationError
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

	def _resolved_content_type(self) -> str:
		content_type = (self.content_type or self.type or self.ContentType.PDF).lower()
		if content_type in {self.ContentType.PDF, self.ContentType.IMAGE, self.ContentType.TEXT}:
			return content_type
		return self.ContentType.PDF

	def clean(self):
		content_type = self._resolved_content_type()

		if content_type == self.ContentType.TEXT:
			if not (self.text_body or "").strip():
				raise ValidationError({"text_body": "Text content required."})
		elif content_type == self.ContentType.IMAGE:
			if not self.file:
				raise ValidationError({"file": "Image required."})
		elif content_type == self.ContentType.PDF:
			if not self.file:
				raise ValidationError({"file": "PDF required."})

	def save(self, *args, **kwargs):
		content_type = self._resolved_content_type()
		self.content_type = content_type
		self.type = content_type

		if content_type == self.ContentType.TEXT:
			self.file = None

		super().save(*args, **kwargs)


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

	def clean(self):
		content_type = (self.content_type or self.ContentType.TEXT).lower()

		if content_type == self.ContentType.TEXT:
			if not (self.title or "").strip():
				raise ValidationError({"title": "Text content title required."})
			if not (self.description or "").strip():
				raise ValidationError({"description": "Text content required."})
		elif content_type == self.ContentType.IMAGE:
			if not self.image:
				raise ValidationError({"image": "Image required."})
		elif content_type == self.ContentType.VIDEO:
			if not self.video:
				raise ValidationError({"video": "Video required."})
