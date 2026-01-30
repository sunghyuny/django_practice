from django.db import models
from django.contrib.auth.models import AbstractBaseUser,BaseUserManager,PermissionsMixin
# Create your models here.


class UserManager(BaseUserManager):
    def _create_user(self, email, nickname, password, **extra_fields):
        if not email:
            raise ValueError('이메일은 필수 항목입니다.')
        if not nickname:
            raise ValueError('닉네임은 필수 항목입니다.')
        email = self.normalize_email(email)
        user = self.model(email=email, nickname=nickname, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, nickname, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, nickname, password, **extra_fields)

    def create_superuser(self, email, nickname, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, nickname, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)     # 아이디로 사용
    nickname = models.CharField(max_length=20, unique=True)
    
    # 필수 시스템 필드 (건드리지 마세요)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    objects = UserManager() # 위에서 만든 설명서 등록

    USERNAME_FIELD = 'email'  # 로그인 ID는 이메일이다!
    REQUIRED_FIELDS = ['nickname'] # 슈퍼유저 만들 때 닉네임도 물어봐라

    def __str__(self):
        return self.nickname