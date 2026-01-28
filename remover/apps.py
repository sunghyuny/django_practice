from django.apps import AppConfig
import sys

class RemoverConfig(AppConfig):
    deafault_auto_field = 'django.db.models.BigAutoField'
    name = 'remover'

    model = None
    device = None

    def ready(self):
        if 'runserver' in sys.argv:
            from .ai_engine.model_loader import load_model as model_loader
            
            self.model , self.device = model_loader()
