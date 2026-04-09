from botocore.exceptions import BotoCoreError, ClientError
from django.contrib import admin, messages
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


class FreeContentInline(admin.TabularInline):
	model = FreeContent
	extra = 1
	fields = ("file", "type", "created_at")
	readonly_fields = ("created_at",)


class PremiumContentInline(admin.TabularInline):
	model = PremiumContent
	extra = 1
	fields = ("title", "description", "image", "image_preview", "created_at")
	readonly_fields = ("image_preview", "created_at")

	@admin.display(description="Preview")
	def image_preview(self, obj: PremiumContent):
		if not obj or not obj.image:
			return "-"
		return format_html(
			'<img src="{}" alt="Premium preview" style="max-height:64px; border-radius:8px;" />',
			obj.image.url,
		)


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


@admin.register(FreeContent)
class FreeContentAdmin(admin.ModelAdmin):
	list_display = ("match", "type", "created_at")
	list_filter = ("type", "created_at")
	search_fields = ("match__match_name",)


@admin.register(PremiumContent)
class PremiumContentAdmin(admin.ModelAdmin):
	list_display = ("match", "title", "has_image", "created_at")
	list_filter = ("created_at",)
	search_fields = ("match__match_name", "title")
	fields = ("match", "title", "description", "image", "image_preview", "created_at")
	readonly_fields = ("image_preview", "created_at")

	@admin.display(boolean=True, description="Has Image")
	def has_image(self, obj: PremiumContent):
		return bool(obj.image)

	@admin.display(description="Image Preview")
	def image_preview(self, obj: PremiumContent):
		if not obj or not obj.image:
			return "-"
		return format_html(
			'<img src="{}" alt="Premium preview" style="max-height:120px; border-radius:10px;" />',
			obj.image.url,
		)
