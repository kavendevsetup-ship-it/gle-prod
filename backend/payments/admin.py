from django.contrib import admin

from .models import MatchPurchase


@admin.register(MatchPurchase)
class MatchPurchaseAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"match",
		"payment_id",
		"amount",
		"status",
		"created_at",
	)
	list_filter = ("status", "created_at")
	search_fields = ("payment_id", "user__email", "match__match_name")
	autocomplete_fields = ("user", "match")
