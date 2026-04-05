from botocore.exceptions import BotoCoreError, ClientError
from django.contrib import admin, messages
from django.http import HttpResponseRedirect

from .models import FreeContent, Match, PremiumContent


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
			return super().changeform_view(request, object_id, form_url, extra_context)
		except (ClientError, BotoCoreError):
			self.message_user(
				request,
				"Unable to save uploaded content to storage. Please verify your AWS S3 credentials and bucket permissions, then try again.",
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
