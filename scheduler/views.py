# scheduler/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum # 합계 계산 함수
from datetime import timedelta
from .models import Task, TaskLog, Spending, Game
from .serializers import TaskSerializer, SpendingSerializer

# 1. 숙제 대시보드 API
from rest_framework.permissions import IsAuthenticated, AllowAny # AllowAny 추가
from django.contrib.auth.models import User # User 추가

class DashboardAPI(APIView):
    # ★ 1. 누구나 접속 허용 (로그인 체크 끔)
    permission_classes = [AllowAny]

    def get(self, request):
        # ★ 2. 로그인 안 했으면? -> 강제로 첫 번째 유저(관리자)라고 가정함
        if request.user.is_authenticated:
            user = request.user
        else:
            user = User.objects.first() # DB에 있는 1번 유저(admin) 소환

        # --- 아래 로직은 기존과 동일 ---
        
        # 1. 모든 숙제 가져오기
        tasks = Task.objects.all().order_by('-priority', 'reset_type')
        serializer = TaskSerializer(tasks, many=True)
        
        # 2. 날짜 필터링 로직
        now = timezone.now()
        today = now.date()
        start_of_week = today - timedelta(days=today.weekday())

        daily_done = TaskLog.objects.filter(
            user=user, task__reset_type='DAILY', completed_at__date=today
        ).values_list('task_id', flat=True)
        
        weekly_done = TaskLog.objects.filter(
            user=user, task__reset_type='WEEKLY', completed_at__date__gte=start_of_week
        ).values_list('task_id', flat=True)
        
        season_done = TaskLog.objects.filter(
            user=user, task__reset_type__in=['BIWEEKLY', 'FOUR_WEEKS', 'PATCH', 'MONTHLY']
        ).values_list('task_id', flat=True)

        done_ids = list(daily_done) + list(weekly_done) + list(season_done)

        return Response({
            "tasks": serializer.data,
            "done_ids": list(set(done_ids))
        })

# 2. 숙제 토글 API
class ToggleTaskAPI(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, task_id):
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return Response({"error": "No Task"}, status=404)
            
        user = request.user
        today = timezone.now().date()
        
        if task.reset_type == 'DAILY':
            log = TaskLog.objects.filter(user=user, task=task, completed_at__date=today).last()
        else:
            log = TaskLog.objects.filter(user=user, task=task).last()
            
        if log:
            log.delete()
            return Response({"status": "unchecked"})
        else:
            TaskLog.objects.create(user=user, task=task)
            return Response({"status": "checked"})

# 3. ★ 가계부 API (통계 + 리스트)

class SpendingAPI(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            user = request.user
        else:
            user = User.objects.first()
        
        now = timezone.now()
        
        # 1. 쿼리셋 준비 (아직 DB 안 때림)
        history_qs = Spending.objects.filter(user=user).order_by('-purchased_at')
        
        # 2. 이번 달 데이터 (Total 계산용)
        # 쿼리 최적화: 필요한 필드(amount, game__name)만 가져와서 계산
        this_month_qs = history_qs.filter(purchased_at__year=now.year, purchased_at__month=now.month)
        
        total_amount = this_month_qs.aggregate(Sum('amount'))['amount__sum'] or 0
        ww_sum = this_month_qs.filter(game__name='명조').aggregate(Sum('amount'))['amount__sum'] or 0
        nikke_sum = this_month_qs.filter(game__name='니케').aggregate(Sum('amount'))['amount__sum'] or 0

        # ★ 3. 리스트는 최근 20개만 자르기 (속도 핵심!)
        # 전체 내역이 필요하면 슬라이싱([:20])을 하거나 Paginator를 써야 함
        recent_history = history_qs[:20] 
        serializer = SpendingSerializer(recent_history, many=True)

        category_list = [
            {"code": key, "name": value} 
            for key, value in Spending.CATEGORY_CHOICES
        ]
        return Response({
            "summary": {
                "month": now.month,
                "total": total_amount,
                "breakdown": {"ww": ww_sum, "nikke": nikke_sum}
                
            },
            "history": serializer.data, # 이제 20개만 가니까 엄청 빠름
            "categories": category_list
        })
    
    def post(self, request):
        """
        [POST] 지출 내역 추가
        """
        serializer = SpendingSerializer(data=request.data)
        if serializer.is_valid():
            # ★ 3. 로그인 안 했으면 관리자 계정으로 저장
            if request.user.is_authenticated:
                target_user = request.user
            else:
                target_user = User.objects.first()
            
            serializer.save(user=target_user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)