from botocore.exceptions import BotoCoreError, ClientError
from django.contrib import admin, messages
from django import forms
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils.html import format_html
from django.utils import timezone
from zoneinfo import ZoneInfo

from .models import FreeContent, Match, PremiumContent


IST = ZoneInfo("Asia/Kolkata")


def _format_storage_error(exc: Exception) -> str:
	if isinstance(exc, ClientError):
		error = exc.response.get("Error", {})
		code = error.get("Code", "ClientError")
		message = error.get("Message", "Storage request failed")
		return f"Storage upload failed ({code}): {message}"

	return f"Storage upload failed ({exc.__class__.__name__})."


class FreeContentAdminForm(forms.ModelForm):
	class Meta:
		model = FreeContent
		fields = "__all__"

	def clean(self):
		cleaned_data = super().clean()
		content_type = cleaned_data.get("content_type") or cleaned_data.get("type") or FreeContent.ContentType.PDF
		file = cleaned_data.get("file")
		text_title = (cleaned_data.get("text_title") or "").strip()
		text_body = (cleaned_data.get("text_body") or "").strip()

		if content_type in {FreeContent.ContentType.PDF, FreeContent.ContentType.IMAGE} and not file:
			self.add_error("file", "File is required for PDF and image content.")

		if content_type == FreeContent.ContentType.TEXT and not text_body:
			self.add_error("text_body", "Text body is required for text content.")

		if text_title:
			cleaned_data["text_title"] = text_title

		if text_body:
			cleaned_data["text_body"] = text_body

		return cleaned_data

	def save(self, commit=True):
		obj = super().save(commit=False)
		content_type = self.cleaned_data.get("content_type") or self.cleaned_data.get("type") or FreeContent.ContentType.PDF
		obj.content_type = content_type
		obj.type = content_type

		if content_type == FreeContent.ContentType.TEXT:
			obj.file = None
		else:
			obj.text_title = None
			obj.text_body = None

		if commit:
			obj.save()

		return obj


class FreeContentInline(admin.TabularInline):
	model = FreeContent
	extra = 1
	form = FreeContentAdminForm
	fields = ("content_type", "file", "text_title", "text_body", "created_at")
	readonly_fields = ("created_at",)

	class Media:
		js = ("matches/js/free_content_admin.js",)


class PremiumContentAdminForm(forms.ModelForm):
	class Meta:
		model = PremiumContent
		fields = "__all__"

	def clean(self):
		cleaned_data = super().clean()
		content_type = cleaned_data.get("content_type") or PremiumContent.ContentType.TEXT
		title = (cleaned_data.get("title") or "").strip()
		description = (cleaned_data.get("description") or "").strip()
		image = cleaned_data.get("image")
		video = cleaned_data.get("video")

		if content_type == PremiumContent.ContentType.TEXT:
			if not title:
				self.add_error("title", "Title is required for text content.")
			if not description:
				self.add_error("description", "Description is required for text content.")

		if content_type == PremiumContent.ContentType.IMAGE and not image:
			self.add_error("image", "Image file is required for image content.")

		if content_type == PremiumContent.ContentType.VIDEO and not video:
			self.add_error("video", "Video file is required for video content.")

		return cleaned_data


class PremiumContentInline(admin.TabularInline):
	model = PremiumContent
	extra = 1
	form = PremiumContentAdminForm
	fields = (
		"content_type",
		"title",
		"description",
		"image",
		"video",
		"image_preview",
		"video_preview",
		"created_at",
	)
	readonly_fields = ("image_preview", "video_preview", "created_at")

	@admin.display(description="Preview")
	def image_preview(self, obj: PremiumContent):
		if not obj or not obj.image:
			return "-"
		return format_html(
			'<img src="{}" alt="Premium preview" style="max-height:64px; border-radius:8px;" />',
			obj.image.url,
		)

	@admin.display(description="Video Preview")
	def video_preview(self, obj: PremiumContent):
		if not obj or not obj.video:
			return "-"
		return format_html(
			'<video src="{}" controls controlsList="nodownload" '
			'style="max-height:64px; border-radius:8px;"></video>',
			obj.video.url,
		)

	class Media:
		js = ("matches/js/premium_content_admin.js",)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
	list_display = ("match_name", "team_1", "team_2", "match_date_ist", "created_at_ist")
	list_filter = ("match_date",)
	search_fields = ("match_name", "team_1", "team_2")
	ordering = ("-match_date",)
	date_hierarchy = "match_date"
	inlines = [FreeContentInline, PremiumContentInline]

	fieldsets = (
		(
			"Match Details",
			{
				"fields": (
					"match_name",
					"team_1",
					"team_2",
					"match_date",
				)
			},
		),
	)

	@staticmethod
	def _format_ist(value):
		if value is None:
			return "-"
		return timezone.localtime(value, IST).strftime("%d-%m-%Y %I:%M %p IST")

	@admin.display(description="Match Date (IST)", ordering="match_date")
	def match_date_ist(self, obj: Match):
		return self._format_ist(obj.match_date)

	@admin.display(description="Created At (IST)", ordering="created_at")
	def created_at_ist(self, obj: Match):
		return self._format_ist(obj.created_at)

	def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
		try:
			with transaction.atomic():
				return super().changeform_view(request, object_id, form_url, extra_context)
		except (ClientError, BotoCoreError) as exc:
			self.message_user(
				request,
				_format_storage_error(exc),
				level=messages.ERROR,
			)
			return HttpResponseRedirect(request.path)

	class Media:
		js = (
			"matches/js/free_content_admin.js",
			"matches/js/premium_content_admin.js",
		)


@admin.register(FreeContent)
class FreeContentAdmin(admin.ModelAdmin):
	form = FreeContentAdminForm
	list_display = ("match", "content_type", "type", "has_file", "has_text", "created_at")
	list_filter = ("content_type", "created_at")
	search_fields = ("match__match_name", "text_title")
	fields = ("match", "content_type", "file", "text_title", "text_body", "created_at")
	readonly_fields = ("created_at",)

	@admin.display(boolean=True, description="Has File")
	def has_file(self, obj: FreeContent):
		return bool(obj.file)

	@admin.display(boolean=True, description="Has Text")
	def has_text(self, obj: FreeContent):
		return bool((obj.text_title or "").strip() or (obj.text_body or "").strip())

	class Media:
		js = ("matches/js/free_content_admin.js",)


@admin.register(PremiumContent)
class PremiumContentAdmin(admin.ModelAdmin):
	form = PremiumContentAdminForm
	list_display = ("match", "content_type", "title", "has_image", "has_video", "created_at")
	list_filter = ("content_type", "created_at")
	search_fields = ("match__match_name", "title")
	fields = (
		"match",
		"content_type",
		"title",
		"description",
		"image",
		"image_preview",
		"video",
		"video_preview",
		"created_at",
	)
	readonly_fields = ("image_preview", "video_preview", "created_at")

	@admin.display(boolean=True, description="Has Image")
	def has_image(self, obj: PremiumContent):
		return bool(obj.image)

	@admin.display(boolean=True, description="Has Video")
	def has_video(self, obj: PremiumContent):
		return bool(obj.video)

	@admin.display(description="Image Preview")
	def image_preview(self, obj: PremiumContent):
		if not obj or not obj.image:
			return "-"
		return format_html(
			'<img src="{}" alt="Premium preview" style="max-height:120px; border-radius:10px;" />',
			obj.image.url,
		)

	@admin.display(description="Video Preview")
	def video_preview(self, obj: PremiumContent):
		if not obj or not obj.video:
			return "-"
		return format_html(
			'<video src="{}" controls controlsList="nodownload" '
			'style="max-height:180px; border-radius:10px;"></video>',
			obj.video.url,
		)

	class Media:
		js = ("matches/js/premium_content_admin.js",)
