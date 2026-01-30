from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Game, Task, TaskLog, Spending
from .serializers import GameSerializer, TaskSerializer, TaskLogSerializer, SpendingSerializer
from .ai_advisor import generate_spending_warning
from django.db.models import Sum, Q 
from datetime import date, timedelta


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            # 시스템 공통 숙제 + 내 숙제
            return Task.objects.filter(Q(user__isnull=True) | Q(user=user))

        return Task.objects.filter(user__isnull=True)

    def perform_create(self, serializer):
        # 유저가 만드는 숙제는 자동으로 본인 소유
        serializer.save(user=self.request.user)


class TaskLogViewSet(viewsets.ModelViewSet):
    queryset = TaskLog.objects.all()
    serializer_class = TaskLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class SpendingViewSet(viewsets.ModelViewSet):
    queryset = Spending.objects.all()
    serializer_class = SpendingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # 1. 기본 저장 로직 실행
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        response_data = serializer.data

        # 2. [Smart Alert Logic] 지출 분석 및 AI 경고 생성
        user = request.user
        game_id = serializer.validated_data['game'].id
        amount = serializer.validated_data['amount']
        
        
        # 지난 2달간 해당 게임 평균 지출 계산 (로직 단순화로 인해 이번달 vs 지난달 비교로 대체)


        # 간단하게 '이번 달' vs '지난 달' 비교로 변경 (질문 의도 반영)
        # 실제로는 복잡한 쿼리가 필요할 수 있으나, 여기선 간단히 구현
        
        # 이번 달 총액
        today = date.today()

        this_month_start = today.replace(day=1)
        current_month_total = Spending.objects.filter(
            user=user,
            purchased_at__gte=this_month_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        # 지난 달 총액
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        last_month_total = Spending.objects.filter(
            user=user,
            purchased_at__gte=last_month_start,
            purchased_at__lte=last_month_end
        ).aggregate(total=Sum('amount'))['total'] or 0

        # 경고 조건: 이번 달 지출이 지난 달 지출을 벌써 넘어섰거나, 특정 금액 이상일 때
        # 여기서는 '지난 달 보다 많이 썼을 때'로 설정
        warning_msg = None
        if last_month_total > 0 and current_month_total > last_month_total:
             warning_msg = generate_spending_warning(
                 user.nickname, 
                 serializer.validated_data['game'].name,
                 current_month_total,
                 last_month_total
             )
        
        if warning_msg:
            response_data['warning_message'] = warning_msg

        if warning_msg:
            response_data['warning_message'] = warning_msg

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        user = request.user
        today = date.today()
        this_month_start = today.replace(day=1)
        
        # 이번 달 지출 전체
        spendings = Spending.objects.filter(user=user, purchased_at__gte=this_month_start)
        
        # 전체 합계
        total_amount = spendings.aggregate(total=Sum('amount'))['total'] or 0
        
        # 게임별 합계 (ID 1: 명조, 2: 니케)
        # 실제로는 Game 모델을 조회하거나 group by를 써야하지만, 요구사항에 맞춰 하드코딩된 키(ww, nikke) 사용
        ww_total = spendings.filter(game_id=1).aggregate(t=Sum('amount'))['t'] or 0
        nikke_total = spendings.filter(game_id=2).aggregate(t=Sum('amount'))['t'] or 0
        
        return Response({
            "total": total_amount,
            "breakdown": {
                "ww": ww_total,
                "nikke": nikke_total
            }
        })
