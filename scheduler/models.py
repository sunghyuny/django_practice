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
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True) # null이면 시스템 공통 숙제
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
    user = models.ForeignKey(User, on_delete=models.CASCADE, default=1)
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
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, default=1)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    
    item_name = models.CharField(max_length=100) # 예: 금희 스킨
    amount = models.IntegerField()               # 금액 (원)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='PACK')
    purchased_at = models.DateField()            # 구매 날짜
    memo = models.TextField(blank=True)          # 간단한 메모

    def __str__(self):
        return f"[{self.game}] {self.item_name} ({self.amount}원)"


# ★ [NEW] 저축 목표 (WishList / Piggy Bank)
class SavingGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, default=1)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    item_name = models.CharField(max_length=100)       # 예: "신염의 율자 스킨"
    target_amount = models.IntegerField()               # 목표 금액 (원)
    saved_amount = models.IntegerField(default=0)       # 현재 저축 금액
    target_date = models.DateField(null=True, blank=True)  # 목표 날짜
    is_achieved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.game}] {self.item_name} ({self.saved_amount}/{self.target_amount}원)"

    @property
    def progress_percent(self):
        if self.target_amount <= 0:
            return 100
        return min(round((self.saved_amount / self.target_amount) * 100, 1), 100)

class GachaProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, default=1)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    
    # 보유 재화
    currency = models.IntegerField(default=0)  # 명조: 별의소리 / 니케: 쥬얼
    tickets = models.IntegerField(default=0)   # 명조: 회오리의 무늬 / 니케: 특수 모집 티켓
    
    # 천장 상태
    pity_stack = models.IntegerField(default=0)        # 명조: 스택(0~80) / 니케: 골드 마일리지
    is_guaranteed = models.BooleanField(default=False) # 명조 전용: 반천장 픽뚫(확천장) 여부
    
    # 미래 재화 획득 기준치 (명조 전용)
    has_monthly_pass = models.BooleanField(default=True)
    tower_avg_stars = models.IntegerField(default=800)   # 역경의 탑 1주기(약 14일)당 획득량
    ruins_avg_reward = models.IntegerField(default=800)  # 바닷속 폐허 1주기(약 30일) 획득량

    # 목표 스케줄
    target_date = models.DateField(null=True, blank=True) # 목표 픽업 마감일