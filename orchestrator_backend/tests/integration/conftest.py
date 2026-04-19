import os
import django
import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'orchestrator_backend.settings')
django.setup()

from django.contrib.auth.models import Group  # noqa: E402
from rest_framework.authtoken.models import Token  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from gateway.constants import ADMIN_ROLE, EMPLOYEE_ROLE, ROLE_GROUP_MAP  # noqa: E402


@pytest.fixture
def admin_user(django_user_model):
    admin_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[ADMIN_ROLE])
    user = django_user_model.objects.create_user(username='admin_int', password='pass1234')
    user.groups.add(admin_group)
    return user


@pytest.fixture
def employee_user(django_user_model):
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user = django_user_model.objects.create_user(username='emp_int', password='pass1234')
    user.groups.add(employee_group)
    return user


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=admin_user)
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client


@pytest.fixture
def employee_client(employee_user):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=employee_user)
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client
