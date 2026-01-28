# scheduler/serializers.py
from rest_framework import serializers
from .models import Game, Task, TaskLog, Spending

class TaskSerializer(serializers.ModelSerializer):
    game_name = serializers.CharField(source='game.name', read_only=True)
    days_remaining = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = ['id', 'game_name', 'title', 'reset_type', 'reward', 'priority', 'due_date', 'days_remaining']

# ★ 가계부용 시리얼라이저
class SpendingSerializer(serializers.ModelSerializer):
    game_name = serializers.CharField(source='game.name', read_only=True)

    class Meta:
        model = Spending
        fields = ['id', 'game', 'game_name', 'item_name', 'amount', 'category', 'purchased_at', 'memo']