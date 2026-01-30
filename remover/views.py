from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.core.files.storage import FileSystemStorage
from django.apps import apps
from django.conf import settings
import os
import uuid
import io

# 우리가 만든 AI 처리 함수 가져오기
from .ai_engine.processor import remove_background
from .ai_engine.model_loader import load_model


class RemoveBackgroundView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

        upload_file = request.FILES['image']
        
        # 1. 파일 저장
        fs = FileSystemStorage()
        filename, ext = os.path.splitext(upload_file.name)
        new_filename = f"{uuid.uuid4()}{ext}"
        file_path = fs.save(f"uploads/{new_filename}", upload_file)
        original_url = fs.url(file_path)

        # 2. AI 모델 가져오기 (Lazy Loading)
        try:
            app_config = apps.get_app_config('remover')
            if app_config.model is None:
                print("⚡ AI 모델이 로드되지 않았습니다. 지금 로딩을 시작합니다...")
                app_config.model, app_config.device = load_model()
            
            model = app_config.model
            device = app_config.device
        except Exception as e:
             print(f"Model Load Error: {e}")
             return Response({'error': 'AI Model Load Failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        # 파일 커서 초기화
        upload_file.seek(0)

        # 3. 배경 제거 수행
        try:
            image_bytes = upload_file.read()
            result_image = remove_background(image_bytes, model, device)
            
            # 4. 결과 이미지 저장
            result_io = io.BytesIO()
            result_image.save(result_io, format="PNG")
            
            result_filename = f"results/{uuid.uuid4()}.png"
            fs.save(result_filename, result_io)
            result_url = fs.url(result_filename)
            
            # 절대 URL 생성을 위해 request 객체 활용 가능하지만, 
            # 일단 상대 경로(또는 MEDIA_URL 포함 경로) 반환
            return Response({
                'original_url': original_url,
                'result_url': result_url
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)