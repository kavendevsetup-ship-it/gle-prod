from rest_framework import serializers

from .models import FreeContent, Match, PremiumContent


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ["id", "team_1", "team_2", "match_name", "match_date"]


class FreeContentSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = FreeContent
        fields = ["id", "type", "file"]

    def get_file(self, obj: FreeContent) -> str | None:
        request = self.context.get("request")
        if not obj.file:
            return None
        if request is None:
            return obj.file.url
        return request.build_absolute_uri(obj.file.url)


class PremiumContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PremiumContent
        fields = ["id", "title", "description"]
