from django.contrib import admin

from .models import MatchPurchase, PricingConfig


@admin.register(MatchPurchase)
class MatchPurchaseAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"match",
		"is_subscription",
		"subscription_end",
		"payment_id",
		"amount",
		"status",
		"created_at",
	)
	list_filter = ("is_subscription", "status", "created_at")
	search_fields = ("payment_id", "user__email", "match__match_name")
	autocomplete_fields = ("user", "match")


@admin.register(PricingConfig)
class PricingConfigAdmin(admin.ModelAdmin):
	list_display = ("match_price", "monthly_price", "is_active", "created_at")
	list_filter = ("is_active", "created_at")
	search_fields = ("match_price", "monthly_price")
	readonly_fields = ("created_at",)
	ordering = ("-created_at", "-id")

	fieldsets = (
		(
			None,
			{
				"fields": (
					("match_price", "monthly_price"),
					"is_active",
					"created_at",
				),
			},
		),
	)
