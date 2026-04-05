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

	USERNAME_FIELD = "email"
	REQUIRED_FIELDS = ["username"]

	class Meta:
		verbose_name = "User"
		verbose_name_plural = "Users"

	def __str__(self) -> str:
		return self.email
