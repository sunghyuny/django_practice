from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Game, Task, TaskLog, Spending, SavingGoal
from .serializers import (
    GameSerializer, TaskSerializer, TaskLogSerializer,
    SpendingSerializer, SavingGoalSerializer,
)
from .ai_advisor import generate_spending_warning
from .discord_notify import send_discord_reminder
from django.db.models import Sum, Q
from django.http import HttpResponse
from datetime import date, timedelta, datetime
import csv


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Task.objects.filter(Q(user__isnull=True) | Q(user=user))
        return Task.objects.filter(user__isnull=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # ★ Feature 2: 오늘 기준 숙제 완료 상태 조회
    @action(detail=False, methods=['get'])
    def today_status(self, request):
        """각 숙제의 오늘 기준 완료 여부를 반환"""
        user = request.user
        if not user.is_authenticated:
            return Response([])

        tasks = self.get_queryset()
        today = date.today()
        now = datetime.now()
        result = []

        for task in tasks:
            # 각 reset_type에 따른 "현재 주기의 시작시간" 계산
            reset_start = self._get_reset_start(task.reset_type, today)

            # 해당 주기 내에 완료 로그가 있는지 확인
            is_done = TaskLog.objects.filter(
                user=user,
                task=task,
                completed_at__gte=reset_start
            ).exists()

            result.append({
                'task_id': task.id,
                'is_done': is_done,
            })

        return Response(result)

    # ★ Feature 3: 스크린샷으로 숙제 완료
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def complete_with_screenshot(self, request, pk=None):
        """스크린샷을 첨부하여 숙제를 완료 처리"""
        task = self.get_object()
        screenshot = request.FILES.get('screenshot')

        log = TaskLog.objects.create(
            user=request.user,
            task=task,
            screenshot=screenshot
        )

        return Response({
            'message': f'"{task.title}" 숙제가 완료 처리되었습니다!',
            'log_id': log.id,
        }, status=status.HTTP_201_CREATED)

    # ★ Feature 5: 디스코드 알림 전송
    @action(detail=False, methods=['post'])
    def send_reminder(self, request):
        """미완료 숙제를 Discord Webhook으로 전송"""
        user = request.user
        webhook_url = user.discord_webhook_url

        if not webhook_url:
            return Response(
                {'error': 'Discord Webhook URL이 설정되지 않았습니다. 설정 페이지에서 등록해주세요.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 오늘 미완료 숙제 목록 계산
        tasks = self.get_queryset()
        today = date.today()
        incomplete = []

        for task in tasks:
            reset_start = self._get_reset_start(task.reset_type, today)
            is_done = TaskLog.objects.filter(
                user=user, task=task, completed_at__gte=reset_start
            ).exists()

            if not is_done:
                incomplete.append({
                    'title': task.title,
                    'game_name': task.game.name,
                    'reset_type': task.reset_type,
                })

        if not incomplete:
            return Response({'message': '🎉 모든 숙제를 완료했습니다! 알림을 보낼 필요가 없어요.'})

        success = send_discord_reminder(webhook_url, incomplete, user.nickname)

        if success:
            return Response({'message': f'✅ Discord로 미완료 숙제 {len(incomplete)}개 알림을 전송했습니다!'})
        else:
            return Response(
                {'error': 'Discord 전송에 실패했습니다. Webhook URL을 확인해주세요.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_reset_start(self, reset_type, today):
        """리셋 타입에 따른 현재 주기 시작 시점 계산 (매일 05:00 기준)"""
        reset_hour = 5  # 새벽 5시 기준

        if reset_type == 'DAILY':
            if datetime.now().hour < reset_hour:
                return datetime.combine(today - timedelta(days=1), datetime.min.time().replace(hour=reset_hour))
            return datetime.combine(today, datetime.min.time().replace(hour=reset_hour))

        elif reset_type == 'WEEKLY':
            # 월요일 05:00 기준
            days_since_monday = today.weekday()
            monday = today - timedelta(days=days_since_monday)
            reset_dt = datetime.combine(monday, datetime.min.time().replace(hour=reset_hour))
            if datetime.now() < reset_dt:
                reset_dt -= timedelta(weeks=1)
            return reset_dt

        elif reset_type == 'BIWEEKLY':
            # 2주 단위 (간단히 짝수 주 월요일 기준)
            days_since_monday = today.weekday()
            monday = today - timedelta(days=days_since_monday)
            week_num = monday.isocalendar()[1]
            if week_num % 2 != 0:
                monday -= timedelta(weeks=1)
            return datetime.combine(monday, datetime.min.time().replace(hour=reset_hour))

        elif reset_type == 'MONTHLY':
            # 매월 1일 05:00
            first_of_month = today.replace(day=1)
            reset_dt = datetime.combine(first_of_month, datetime.min.time().replace(hour=reset_hour))
            if datetime.now() < reset_dt:
                # 이전 달로
                first_of_month = (first_of_month - timedelta(days=1)).replace(day=1)
                reset_dt = datetime.combine(first_of_month, datetime.min.time().replace(hour=reset_hour))
            return reset_dt

        elif reset_type in ('FOUR_WEEKS', 'PATCH'):
            # 4주/패치: 매월 1일과 동일 처리 (단순화)
            first_of_month = today.replace(day=1)
            return datetime.combine(first_of_month, datetime.min.time().replace(hour=reset_hour))

        # fallback
        return datetime.combine(today, datetime.min.time())


class TaskLogViewSet(viewsets.ModelViewSet):
    serializer_class = TaskLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TaskLog.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # ★ Feature 4: 숙제 로그 CSV 내보내기
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="task_logs.csv"'
        response.write('\ufeff')  # BOM for Excel

        writer = csv.writer(response)
        writer.writerow(['완료일', '게임', '숙제', '리셋타입'])

        logs = self.get_queryset().select_related('task', 'task__game').order_by('-completed_at')
        for log in logs:
            writer.writerow([
                log.completed_at.strftime('%Y-%m-%d %H:%M'),
                log.task.game.name,
                log.task.title,
                log.task.reset_type,
            ])

        return response


class SpendingViewSet(viewsets.ModelViewSet):
    serializer_class = SpendingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Spending.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        headers = self.get_success_headers(serializer.data)
        response_data = serializer.data

        # [Smart Alert Logic]
        user = request.user
        amount = serializer.validated_data['amount']

        today = date.today()
        this_month_start = today.replace(day=1)
        current_month_total = Spending.objects.filter(
            user=user,
            purchased_at__gte=this_month_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        last_month_total = Spending.objects.filter(
            user=user,
            purchased_at__gte=last_month_start,
            purchased_at__lte=last_month_end
        ).aggregate(total=Sum('amount'))['total'] or 0

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

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        user = request.user
        today = date.today()
        this_month_start = today.replace(day=1)

        spendings = Spending.objects.filter(user=user, purchased_at__gte=this_month_start)

        total_amount = spendings.aggregate(total=Sum('amount'))['total'] or 0

        # 게임별 합계
        ww_total = spendings.filter(game_id=1).aggregate(t=Sum('amount'))['t'] or 0
        nikke_total = spendings.filter(game_id=2).aggregate(t=Sum('amount'))['t'] or 0

        # ★ Feature 1: 카테고리별 breakdown 추가
        category_breakdown = {}
        for cat_code, cat_name in Spending.CATEGORY_CHOICES:
            cat_total = spendings.filter(category=cat_code).aggregate(t=Sum('amount'))['t'] or 0
            category_breakdown[cat_code] = {'name': cat_name, 'total': cat_total}

        return Response({
            "total": total_amount,
            "breakdown": {
                "ww": ww_total,
                "nikke": nikke_total,
            },
            "category_breakdown": category_breakdown,
        })

    # ★ Feature 1: 최근 6개월 월별 지출 추이
    @action(detail=False, methods=['get'])
    def spending_trend(self, request):
        user = request.user
        today = date.today()

        months = []
        for i in range(5, -1, -1):
            # i개월 전
            d = today.replace(day=1) - timedelta(days=i * 30)
            month_start = d.replace(day=1)
            if i > 0:
                next_month = (month_start + timedelta(days=32)).replace(day=1)
            else:
                next_month = (today + timedelta(days=1))

            total = Spending.objects.filter(
                user=user,
                purchased_at__gte=month_start,
                purchased_at__lt=next_month
            ).aggregate(t=Sum('amount'))['t'] or 0

            months.append({
                'month': month_start.strftime('%Y-%m'),
                'label': f"{month_start.month}월",
                'total': total,
            })

        return Response(months)

    # ★ Feature 4: 지출 CSV 내보내기
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="spendings.csv"'
        response.write('\ufeff')  # BOM for Excel

        writer = csv.writer(response)
        writer.writerow(['구매일', '게임', '아이템', '카테고리', '금액', '메모'])

        spendings = self.get_queryset().select_related('game').order_by('-purchased_at')
        for s in spendings:
            writer.writerow([
                s.purchased_at.strftime('%Y-%m-%d'),
                s.game.name,
                s.item_name,
                s.get_category_display(),
                s.amount,
                s.memo,
            ])

        return response


# ★ Feature 6: 저축 목표 (WishList / Piggy Bank)
class SavingGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavingGoal.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_savings(self, request, pk=None):
        """저축 금액 추가"""
        goal = self.get_object()
        amount = request.data.get('amount', 0)

        try:
            amount = int(amount)
        except (ValueError, TypeError):
            return Response({'error': '유효한 금액을 입력해주세요.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'error': '양수 금액만 입력 가능합니다.'}, status=status.HTTP_400_BAD_REQUEST)

        goal.saved_amount += amount
        if goal.saved_amount >= goal.target_amount:
            goal.is_achieved = True
        goal.save()

        serializer = self.get_serializer(goal)
        return Response({
            'message': f'{amount:,}원 저축 완료! 🎉' if goal.is_achieved else f'{amount:,}원 저축 완료!',
            'goal': serializer.data,
        })

# ★ [NEW] 가챠/픽업 플래너
from .models import GachaProfile
from .serializers import GachaProfileSerializer

class GachaProfileViewSet(viewsets.ModelViewSet):
    serializer_class = GachaProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GachaProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def calculate_plan(self, request):
        user = request.user
        game_id = request.query_params.get('game_id')
        if not game_id:
            return Response({'error': 'game_id required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            profile = GachaProfile.objects.get(user=user, game_id=game_id)
        except GachaProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        if not profile.target_date:
            return Response({'error': '목표 날짜(D-Day)를 설정해주세요.'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        days_remaining = (profile.target_date - today).days
        if days_remaining < 0:
            days_remaining = 0

        expected_income = 0
        game_name = profile.game.name
        
        if game_name == '명조':
            # 1. 자연 획득량 계산
            # 일일 퀘스트: 일 60
            expected_income += days_remaining * 60
            # 월정액: 일 90
            if profile.has_monthly_pass:
                expected_income += days_remaining * 90
            # 역경의 탑 (1주기 14일)
            tower_resets = days_remaining / 14.0
            expected_income += int(tower_resets * profile.tower_avg_stars)
            # 바닷속 폐허 (1주기 30일 가정)
            ruins_resets = days_remaining / 30.0
            expected_income += int(ruins_resets * profile.ruins_avg_reward)

            # 2. 필요 총 재화 계산
            needed_pulls = 80 - profile.pity_stack
            if not profile.is_guaranteed:
                needed_pulls += 80  # 최악 반천장 가정 (총 160)
            
            # (필요 뽑기 수 - 보유 티켓) * 1뽑 가격 - 보유 재화
            total_needed_currency = (needed_pulls - profile.tickets) * 160 - profile.currency
            
            # 3. 부족분 및 트럭 계산
            shortfall = total_needed_currency - expected_income
            if shortfall < 0:
                shortfall = 0

            # 1트럭 = 119,000원 = 기준 8080개 (명조 초회 제외 평균 가성비)
            trucks_needed = int((shortfall + 8079) // 8080)
            cost_krw = trucks_needed * 119000

        elif game_name == '니케':
            # 니케 로직 (임시 단순계산: 하루 평균 100쥬얼 가정)
            expected_income += days_remaining * 100
            
            # 니케 천장은 200 마일리지
            needed_pulls = 200 - profile.pity_stack
            if needed_pulls < 0:
                needed_pulls = 0
                
            total_needed_currency = (needed_pulls - profile.tickets) * 300 - profile.currency
            shortfall = total_needed_currency - expected_income
            if shortfall < 0:
                shortfall = 0

            # 1트럭 = 119,000원 = 기준 8000개
            trucks_needed = int((shortfall + 7999) // 8000)
            cost_krw = trucks_needed * 119000
        else:
            return Response({'error': '지원하지 않는 게임입니다.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'days_remaining': days_remaining,
            'expected_income': expected_income,
            'total_needed_currency': total_needed_currency if total_needed_currency > 0 else 0,
            'shortfall': shortfall,
            'trucks_needed': trucks_needed,
            'cost_krw': cost_krw,
            'profile_id': profile.id
        })
