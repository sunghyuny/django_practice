from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TaskViewSet, TaskLogViewSet, SpendingViewSet, SavingGoalViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet)
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'logs', TaskLogViewSet, basename='tasklog')
router.register(r'spendings', SpendingViewSet, basename='spending')
router.register(r'saving-goals', SavingGoalViewSet, basename='savinggoal')

urlpatterns = [
    path('', include(router.urls)),
]