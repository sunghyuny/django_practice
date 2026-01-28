import torch
# ▼ [핵심 수정] models가 아니라 'models.segmentation'에서 직접 가져옵니다.
from torchvision.models.segmentation import deeplabv3_resnet101, DeepLabV3_ResNet101_Weights

def load_model():
    print("AI 모델을 로딩 중입니다... (첫 실행 시 다운로드로 인해 시간이 걸릴 수 있습니다)")
    
    # 1. 가중치(Weights) 가져오기
    weights = DeepLabV3_ResNet101_Weights.DEFAULT
    
    # 2. 모델 생성 (수정된 import 사용)
    model = deeplabv3_resnet101(weights=weights)
    
    # 3. 추론 모드 설정
    model.eval()
    
    # 4. 장치 설정 (GPU/CPU)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    print(f"모델 로드 완료! (사용 장치: {device})")
    return model, device