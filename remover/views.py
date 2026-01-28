from django.shortcuts import render
from django.core.files.storage import FileSystemStorage
from django.conf import settings
from django.apps import apps
import os
import uuid
import io

# 우리가 만든 AI 처리 함수 가져오기
from .ai_engine.processor import remove_background

def index(request):
    if request.method == 'POST' and request.FILES.get('image'):
        upload_file = request.FILES['image']
        
        # 1. 파일 저장 (여기서 파일을 끝까지 읽어버림!)
        fs = FileSystemStorage()
        filename, ext = os.path.splitext(upload_file.name)
        new_filename = f"{uuid.uuid4()}{ext}"
        file_path = fs.save(f"uploads/{new_filename}", upload_file)
        original_url = fs.url(file_path)

        # 2. AI 모델 가져오기
        app_config = apps.get_app_config('remover')
        model = app_config.model
        device = app_config.device

        # ▼ [핵심 수정] 파일 커서를 다시 맨 처음(0)으로 돌려놓기
        upload_file.seek(0)

        # 3. 배경 제거 수행
        image_bytes = upload_file.read()
        result_image = remove_background(image_bytes, model, device)
        # 4. 결과 이미지 저장
        result_io = io.BytesIO()
        result_image.save(result_io, format="PNG") # 투명 배경은 PNG 필수
        
        result_filename = f"results/{uuid.uuid4()}.png"
        fs.save(result_filename, result_io)
        result_url = fs.url(result_filename)

        # 결과 페이지로 보냄
        return render(request, 'remover/result.html', {
            'original_url': original_url,
            'result_url': result_url
        })

    return render(request, 'remover/index.html')