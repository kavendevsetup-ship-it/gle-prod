from botocore.exceptions import BotoCoreError, ClientError
from django.contrib import admin, messages
from django.db import transaction
from django.http import HttpResponseRedirect

from .models import FreeContent, Match, PremiumContent


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
	fields = ("title", "description", "created_at")
	readonly_fields = ("created_at",)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
	list_display = ("match_name", "team_1", "team_2", "match_date", "created_at")
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
	list_display = ("match", "title", "created_at")
	list_filter = ("created_at",)
	search_fields = ("match__match_name", "title")
