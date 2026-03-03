from rest_framework import serializers
from .models import Game, Task, TaskLog, Spending, SavingGoal, GachaProfile

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
    task_title = serializers.ReadOnlyField(source='task.title')
    game_name = serializers.ReadOnlyField(source='task.game.name')

    class Meta:
        model = TaskLog
        fields = '__all__'
        read_only_fields = ('user',)

class SpendingSerializer(serializers.ModelSerializer):
    game_name = serializers.ReadOnlyField(source='game.name')

    class Meta:
        model = Spending
        fields = '__all__'
        read_only_fields = ('user',) # 유저는 뷰에서 자동 할당


# ★ [NEW] 저축 목표 (WishList / Piggy Bank)
class SavingGoalSerializer(serializers.ModelSerializer):
    game_name = serializers.ReadOnlyField(source='game.name')
    progress_percent = serializers.ReadOnlyField()  # 모델의 @property

    class Meta:
        model = SavingGoal
        fields = '__all__'
        read_only_fields = ('user', 'is_achieved')

# ★ [NEW] 가챠/픽업 플래너
class GachaProfileSerializer(serializers.ModelSerializer):
    game_name = serializers.ReadOnlyField(source='game.name')

    class Meta:
        model = GachaProfile
        fields = '__all__'
        read_only_fields = ('user',)