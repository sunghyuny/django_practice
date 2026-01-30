from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TaskViewSet, TaskLogViewSet, SpendingViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet)
router.register(r'tasks', TaskViewSet, basename='task')

router.register(r'logs', TaskLogViewSet)
router.register(r'spendings', SpendingViewSet)

urlpatterns = [
    path('', include(router.urls)),
]