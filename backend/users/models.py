from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
	email = models.EmailField("Email", unique=True)
	profile_photo = models.ImageField(
		"Profile Photo",
		upload_to="profile_photos/",
		blank=True,
		null=True,
	)
	is_premium = models.BooleanField("Is Premium", default=False)
	premium_expiry = models.DateTimeField(
		"Premium Expiry",
		null=True,
		blank=True,
		db_index=True,
	)

	USERNAME_FIELD = "email"
	REQUIRED_FIELDS = ["username"]

	class Meta:
		verbose_name = "User"
		verbose_name_plural = "Users"

	def __str__(self) -> str:
		return self.email


class UpdatePost(models.Model):
	title = models.CharField(max_length=255)
	body = models.TextField(
		help_text="Use line breaks and bullet-style text for clarity",
	)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("-created_at", "-id")
		verbose_name = "Update Post"
		verbose_name_plural = "Update Posts"

	def __str__(self) -> str:
		return self.title


class UserUpdateStatus(models.Model):
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="update_statuses",
	)
	update = models.ForeignKey(
		UpdatePost,
		on_delete=models.CASCADE,
		related_name="user_statuses",
	)
	is_read = models.BooleanField(default=False)
	read_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=("user", "update"), name="unique_user_update_status"),
		]
		verbose_name = "User Update Status"
		verbose_name_plural = "User Update Statuses"

	def __str__(self) -> str:
		status = "read" if self.is_read else "unread"
		return f"{self.user} - {self.update} ({status})"
