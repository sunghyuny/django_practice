# scheduler/admin.py

from django.contrib import admin
from .models import Game, Task, TaskLog, Spending

# 관리자 페이지에서 보고 싶은 모델들을 등록합니다.
admin.site.register(Game)      # 게임 (명조, 니케)
admin.site.register(Task)      # 숙제 (일퀘, 주간퀘)
admin.site.register(TaskLog)   # 완료 기록
admin.site.register(Spending)  # 가계부