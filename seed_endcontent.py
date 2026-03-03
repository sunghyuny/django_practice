import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nukki_project.settings')
django.setup()

from scheduler.models import Game, Task

def run():
    ww = Game.objects.get(id=1)  # 명조

    # ★ 타워 (Tower) - 4주 주기
    Task.objects.get_or_create(
        game=ww,
        title='역경의 탑',
        user=None,  # 시스템 공통 숙제
        defaults={
            'reset_type': 'FOUR_WEEKS',
            'reward': '별의소리, 조율기, 육성 소재',
            'priority': 2,
            'due_date': '2026-03-30',  # Season 33 마감
        }
    )

    # ★ 해역 (Hologram) - 4주 주기 (타워와 2주 오프셋)
    Task.objects.get_or_create(
        game=ww,
        title=' 죽음의 노래와 바닷속 폐허',
        user=None,
        defaults={
            'reset_type': 'FOUR_WEEKS',
            'reward': '별의소리, 조율기, 육성 소재',
            'priority': 2,
            'due_date': '2026-03-16',  # Season 14 마감
        }
    )

    print("✅ 명조 엔드콘텐츠 시드 완료!")
    print("   - 전탑 (Tower) Season 33: ~2026-03-30")
    print("   - 홀로그램 해역 Season 14: ~2026-03-16")

if __name__ == '__main__':
    run()
