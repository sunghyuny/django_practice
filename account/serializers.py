from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

# 1. 회원가입용 (비밀번호 암호화 처리)
class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('email', 'nickname', 'password')
        extra_kwargs = {'password': {'write_only': True}} # 비번은 절대 보여주지 않음

    def create(self, validated_data):
        # 우리가 만든 UserManager의 create_user 사용 (암호화)
        user = User.objects.create_user(
            email=validated_data['email'],
            nickname=validated_data['nickname'],
            password=validated_data['password']
        )
        return user

# 2. 프로필 조회용 (내 정보 볼 때)
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # 모델에 정의된 필드들 중 보여줄 것만 선택
        fields = ('email', 'nickname', 'is_staff')

# 3. 로그인용 (이메일/비번만 받음)
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
