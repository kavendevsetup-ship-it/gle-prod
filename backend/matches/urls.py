from django.urls import path

from .views import MatchAccessAPIView, MatchDetailAPIView, MatchListAPIView

urlpatterns = [
    path("matches/", MatchListAPIView.as_view(), name="match-list"),
    path("match/<int:match_id>/", MatchDetailAPIView.as_view(), name="match-detail"),
    path("match/<int:match_id>/access/", MatchAccessAPIView.as_view(), name="match-access"),
]
