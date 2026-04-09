from django.urls import path

from .views import (
    FreeContentPdfProxyAPIView,
    MatchAccessAPIView,
    MatchDetailAPIView,
    MatchListAPIView,
)

urlpatterns = [
    path("matches/", MatchListAPIView.as_view(), name="match-list"),
    path("match/<int:match_id>/", MatchDetailAPIView.as_view(), name="match-detail"),
    path("match/<int:match_id>/access/", MatchAccessAPIView.as_view(), name="match-access"),
    path("free-content/pdf/<int:content_id>/", FreeContentPdfProxyAPIView.as_view(), name="free-content-pdf-proxy"),
]
