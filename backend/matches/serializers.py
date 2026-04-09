from rest_framework import serializers
from django.urls import reverse
from django.utils import timezone

from .models import FreeContent, Match, PremiumContent


class MatchSerializer(serializers.ModelSerializer):
    match_date = serializers.DateTimeField(default_timezone=timezone.get_current_timezone())

    class Meta:
        model = Match
        fields = ["id", "team_1", "team_2", "match_name", "match_date"]


class FreeContentSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()
    file = serializers.SerializerMethodField()

    class Meta:
        model = FreeContent
        fields = ["id", "type", "content_type", "file", "text_title", "text_body"]

    @staticmethod
    def _resolve_type(obj: FreeContent) -> str:
        content_type = (obj.content_type or obj.type or FreeContent.ContentType.PDF).lower()
        if content_type in {
            FreeContent.ContentType.PDF,
            FreeContent.ContentType.IMAGE,
            FreeContent.ContentType.TEXT,
        }:
            return content_type
        return FreeContent.ContentType.PDF

    def get_content_type(self, obj: FreeContent) -> str:
        return self._resolve_type(obj)

    def get_file(self, obj: FreeContent) -> str | None:
        resolved_type = self._resolve_type(obj)
        if resolved_type == FreeContent.ContentType.TEXT:
            return None

        request = self.context.get("request")
        if not obj.file:
            return None

        if resolved_type == FreeContent.ContentType.PDF:
            path = reverse("free-content-pdf-proxy", args=[obj.id])
            return path

        if request is None:
            return obj.file.url
        return request.build_absolute_uri(obj.file.url)


class PremiumContentSerializer(serializers.ModelSerializer):
    content_type = serializers.CharField(read_only=True)
    image = serializers.SerializerMethodField()
    video = serializers.SerializerMethodField()

    class Meta:
        model = PremiumContent
        fields = ["id", "content_type", "title", "description", "image", "video"]

    def _can_show_protected_media(self) -> bool:
        return bool(self.context.get("show_protected_media"))

    def get_image(self, obj: PremiumContent) -> str | None:
        request = self.context.get("request")
        if not obj.image:
            return None
        if request is None:
            return obj.image.url
        return request.build_absolute_uri(obj.image.url)

    def get_video(self, obj: PremiumContent) -> str | None:
        if not self._can_show_protected_media():
            return None

        request = self.context.get("request")
        if not obj.video:
            return None
        if request is None:
            return obj.video.url
        return request.build_absolute_uri(obj.video.url)
