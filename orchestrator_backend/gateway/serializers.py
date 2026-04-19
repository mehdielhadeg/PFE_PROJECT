from pathlib import Path
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers

from .constants import ROLE_GROUP_MAP, ADMIN_ROLE, EMPLOYEE_ROLE
from .models import ChatMessage, Feedback


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context.get('request')
        role = self.context.get('role')

        user = authenticate(request=request, username=attrs['username'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError('Incorrect username or password. Please try again.')

        if not role:
            raise serializers.ValidationError('Role is required.')

        expected_group = ROLE_GROUP_MAP[role]
        has_role = user.is_superuser or user.groups.filter(name=expected_group).exists()
        if not has_role:
            if role == ADMIN_ROLE:
                raise serializers.ValidationError('This account does not have admin access. Use employee login.')
            raise serializers.ValidationError('This account does not have employee access. Use admin login.')

        attrs['user'] = user
        return attrs


class ChatSerializer(serializers.Serializer):
    question = serializers.CharField()
    top_k = serializers.IntegerField(required=False, default=6, min_value=1, max_value=20)


class DocumentUploadSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content_b64 = serializers.CharField()

    def validate_filename(self, value):
        suffix = Path(value).suffix.lower()
        allowed = {'.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'}
        if suffix not in allowed:
            raise serializers.ValidationError(f'Unsupported file type: {suffix}')
        return value


class DocumentEmployeeSerializer(serializers.Serializer):
    name = serializers.CharField()
    open = serializers.CharField(allow_null=True, allow_blank=True)


class DocumentAdminSerializer(DocumentEmployeeSerializer):
    uploaded_by = serializers.CharField(allow_blank=True)
    upload_date = serializers.CharField(allow_blank=True)
    delete = serializers.BooleanField()


class UserOutSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    role = serializers.ChoiceField(choices=[ADMIN_ROLE, EMPLOYEE_ROLE])


class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField(min_length=6, write_only=True)
    role = serializers.ChoiceField(choices=[ADMIN_ROLE, EMPLOYEE_ROLE])

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value


class UserUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150, required=False)
    password = serializers.CharField(min_length=6, write_only=True, required=False, allow_blank=False)
    role = serializers.ChoiceField(choices=[ADMIN_ROLE, EMPLOYEE_ROLE], required=False)

    def validate_username(self, value):
        user_id = self.context.get('user_id')
        if User.objects.exclude(id=user_id).filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value


class ConversationSaveSerializer(serializers.Serializer):
    messages = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        allow_empty=True,
    )


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['is_positive', 'comment', 'created_at']
        read_only_fields = ['created_at']


class FeedbackOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['is_positive', 'comment', 'created_at']
