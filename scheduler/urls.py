from django.contrib import admin
from django.urls import path, include
# ▼ 이 두 줄이 꼭 있어야 합니다!
from django.conf import settings
from django.conf.urls.static import static

from scheduler.views import DashboardAPI, SpendingAPI, ToggleTaskAPI




urlpatterns = [
    path('api/dashboard/', DashboardAPI.as_view(), name='api_dashboard'),
    path('api/toggle/<int:task_id>/', ToggleTaskAPI.as_view(), name='api_toggle'),
    path('api/spending/', SpendingAPI.as_view(), name='api_spending'),
]