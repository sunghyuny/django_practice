import requests
import json
from datetime import datetime


def send_discord_reminder(webhook_url, incomplete_tasks, user_nickname="게이머"):
    """
    미완료 숙제 목록을 Discord Webhook으로 전송합니다.
    """
    if not webhook_url or not incomplete_tasks:
        return False

    # 게임별로 숙제 분류
    tasks_by_game = {}
    for task in incomplete_tasks:
        game = task.get('game_name', '기타')
        if game not in tasks_by_game:
            tasks_by_game[game] = []
        tasks_by_game[game].append(task.get('title', '알 수 없음'))

    # 필드 구성
    fields = []
    for game, titles in tasks_by_game.items():
        task_list = "\n".join([f"• {t}" for t in titles])
        fields.append({
            "name": f"🎮 {game}",
            "value": task_list,
            "inline": False,
        })

    embed = {
        "title": f"📋 {user_nickname}님, 아직 안 한 숙제가 있어요!",
        "description": f"미완료 숙제 **{len(incomplete_tasks)}개**가 남았습니다. 오늘도 파이팅! 💪",
        "color": 0x00D2FF,  # 누끼 브랜드 컬러
        "fields": fields,
        "footer": {
            "text": f"Nukki 비서 • {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        },
    }

    payload = {
        "username": "누끼 비서 🤖",
        "embeds": [embed],
    }

    try:
        response = requests.post(
            webhook_url,
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        return response.status_code == 204
    except Exception as e:
        print(f"Discord Webhook Error: {e}")
        return False
