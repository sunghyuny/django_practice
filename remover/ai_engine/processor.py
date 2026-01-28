# remover/ai_engine/processor.py
import torch
from torchvision import transforms
from PIL import Image
import numpy as np
import io

def remove_background(image_bytes, model, device):
    # 1. 이미지 읽기 (Bytes -> PIL Image)
    input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # 2. 전처리 (모델이 이해하는 형태로 변환)
    preprocess = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    input_tensor = preprocess(input_image).unsqueeze(0) # 배치 차원 추가
    input_tensor = input_tensor.to(device)

    # 3. AI 추론 (Inference)
    with torch.no_grad():
        output = model(input_tensor)['out'][0]
    
    # 4. 마스크 생성
    # output.argmax(0)은 각 픽셀이 어떤 클래스인지(사람, 배경, 차 등) 숫자로 나타냅니다.
    # 0번 클래스가 '배경'입니다. 따라서 0이 아닌 모든 것을 남깁니다.
    output_predictions = output.argmax(0).byte().cpu().numpy()
    
    # 마스크 만들기 (0이 아니면 255(흰색), 0이면 0(검은색))
    mask = (output_predictions != 0).astype(np.uint8) * 255
    
    # 마스크를 원본 크기로 리사이징 (PIL Image로 변환해서 처리)
    mask_image = Image.fromarray(mask).resize(input_image.size, resample=Image.NEAREST)
    
    # 5. 투명 배경 합성
    # 원본 이미지에 알파 채널(투명도) 추가
    input_image.putalpha(mask_image)
    
    return input_image