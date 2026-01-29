from django.db import models
from django.contrib.auth.models import AbstractBaseUser,BaseUserManager,PermissionsMixin
# Create your models here.


class UserManager(BaseUserManager):
    def create_user(self, email, nickname, password=None):
        if not email:
            raise ValueError('이메일이 아닙니다')
        user = self.model(
            email=self.normalize_email(email),
            nickname=nickname
        )
        user.set_password(password) # 비밀번호 암호화
        user.save(using=self._db)
        return user
    def create_superuser(self, email, nickname, password=None):
        user = self.create_user(email, nickname, password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user

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