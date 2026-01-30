from rest_framework import serializers
from .models import Game, Task, TaskLog, Spending

class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = '__all__'

class TaskSerializer(serializers.ModelSerializer):
    game_name = serializers.ReadOnlyField(source='game.name')
    days_remaining = serializers.ReadOnlyField() # 모델의 @property 필드

    class Meta:
        model = Task
        fields = '__all__'

class TaskLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskLog
        fields = '__all__'

class SpendingSerializer(serializers.ModelSerializer):
    game_name = serializers.ReadOnlyField(source='game.name')

    class Meta:
        model = Spending
        fields = '__all__'
        read_only_fields = ('user',) # 유저는 뷰에서 자동 할당