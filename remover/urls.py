from django.urls import path
from .views import RemoveBackgroundView

urlpatterns = [
    path('process/', RemoveBackgroundView.as_view(), name='process'),
]
