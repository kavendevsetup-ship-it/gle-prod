from django.urls import path

from .views import BackendAuthBridgeAPIView

urlpatterns = [
    path("google/", BackendAuthBridgeAPIView.as_view(), name="auth-google-bridge"),
]
