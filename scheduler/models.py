# scheduler/models.py
from django.db import models
from account.models import User
from datetime import date

class Game(models.Model):
    name = models.CharField(max_length=50, unique=True) # 명조, 니케
    icon_url = models.URLField(blank=True, null=True)
    def __str__(self): return self.name

class Task(models.Model):
    RESET_CHOICES = [
        ('DAILY', '매일 (05:00)'),
        ('WEEKLY', '주간 (월요일)'),
        ('BIWEEKLY', '격주 (2주)'),
        ('FOUR_WEEKS', '4주 (월간/시즌)'),
        ('PATCH', '버전/패치 (약 6주)'),
        ('MONTHLY', '매월 1일'),
    ]
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=100)
    reset_type = models.CharField(max_length=20, choices=RESET_CHOICES, default='DAILY')
    reward = models.CharField(max_length=100, blank=True)
    priority = models.IntegerField(default=1)
    due_date = models.DateField(null=True, blank=True)

    def __str__(self): return f"[{self.game}] {self.title}"

    @property
    def days_remaining(self):
        if self.due_date:
            return (self.due_date - date.today()).days
        return None

class TaskLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

# ★ [NEW] 가계부 모델 완성본
class Spending(models.Model):
    CATEGORY_CHOICES = [
        ('MONTHLY', '월정액'),
        ('BP', '패스 (Battle Pass)'),
        ('PACK', '패키지/트럭'),
        ('SKIN', '스킨/코스튬'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    
    item_name = models.CharField(max_length=100) # 예: 금희 스킨
    amount = models.IntegerField()               # 금액 (원)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='PACK')
    purchased_at = models.DateField()            # 구매 날짜
    memo = models.TextField(blank=True)          # 간단한 메모

    def __str__(self):
        return f"[{self.game}] {self.item_name} ({self.amount}원)"