from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from datetime import timedelta

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
	list_display = (
		"email",
		"username",
		"first_name",
		"last_name",
		"is_premium",
		"premium_expiry",
		"is_staff",
		"is_active",
	)
	list_filter = ("is_premium", "is_staff", "is_active", "is_superuser")
	list_editable = ("is_premium",)
	search_fields = ("email", "username", "first_name", "last_name")
	ordering = ("email",)
	actions = ("grant_30_days_premium", "revoke_premium_access")

	fieldsets = BaseUserAdmin.fieldsets + (
		("Premium Access", {"fields": ("is_premium", "premium_expiry")}),
		("Profile", {"fields": ("profile_photo",)}),
	)

	add_fieldsets = BaseUserAdmin.add_fieldsets + (
		("Premium Access", {"fields": ("is_premium", "premium_expiry")}),
		("Profile", {"fields": ("profile_photo",)}),
	)

	@admin.action(description="Grant 30 days premium")
	def grant_30_days_premium(self, request, queryset):
		expiry = timezone.now() + timedelta(days=30)
		updated = queryset.update(is_premium=True, premium_expiry=expiry)
		self.message_user(request, f"Premium granted for 30 days to {updated} user(s).")

	@admin.action(description="Revoke premium access")
	def revoke_premium_access(self, request, queryset):
		updated = queryset.update(is_premium=False, premium_expiry=None)
		self.message_user(request, f"Premium revoked for {updated} user(s).")
