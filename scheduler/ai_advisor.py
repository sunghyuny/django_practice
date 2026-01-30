import random

def generate_spending_warning(user_nickname, game_name, current_amount, avg_amount):
    """
    지출이 평균보다 많을 때 '잔소리'를 생성하는 가상 AI 함수입니다.
    실제 LLM API(OpenAI, Gemini 등)를 연동하면 더 다채로운 드립이 가능합니다.
    """
    diff = current_amount - avg_amount
    ratio = (current_amount / avg_amount) * 100 if avg_amount > 0 else 100

    messages = [
        f"🚨 {user_nickname}님, {game_name}에 또 질러버리셨군요. 지난달보다 {diff:,}원 더 쓰셨습니다. 지갑이 울고 있어요.",
        f"💸 인간적으로 이번 달 {game_name} 과금은 좀 심하지 않나요? 평균보다 {ratio:.1f}% 초과 달성! 축하...할 일이 아닙니다.",
        f"🛑 멈춰! {user_nickname}님, 이 속도면 다음 달엔 라면만 드셔야 합니다. {diff:,}원 아끼면 치킨이 몇 마리인지 아세요?",
        f"📉 사장님, {game_name} 주가 올려주시는 건 감사한데 본인 잔고도 좀 챙기시죠. 위험 수위 돌파했습니다.",
    ]
    
    return random.choice(messages)
