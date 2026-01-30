from django.apps import AppConfig
import sys

class RemoverConfig(AppConfig):
    deafault_auto_field = 'django.db.models.BigAutoField'
    name = 'remover'

    model = None
    device = None

    def ready(self):
        # Lazy Loading으로 변경하기 위해 ready에서는 로드하지 않음
        pass

