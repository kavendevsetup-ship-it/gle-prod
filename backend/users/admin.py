from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
	list_display = (
		"email",
		"username",
		"first_name",
		"last_name",
		"is_staff",
		"is_active",
	)
	search_fields = ("email", "username", "first_name", "last_name")
	ordering = ("email",)

	fieldsets = BaseUserAdmin.fieldsets + (
		("Profile", {"fields": ("profile_photo",)}),
	)

	add_fieldsets = BaseUserAdmin.add_fieldsets + (
		("Profile", {"fields": ("profile_photo",)}),
	)
