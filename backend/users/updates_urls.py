from django.urls import path

from .views import UpdateMarkReadAPIView, UpdatesListAPIView

urlpatterns = [
    path("updates/", UpdatesListAPIView.as_view(), name="updates-list"),
    path("updates/<int:update_id>/mark-read/", UpdateMarkReadAPIView.as_view(), name="updates-mark-read"),
]
