import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIRequestFactory

from gateway.constants import ADMIN_ROLE, EMPLOYEE_ROLE, ROLE_GROUP_MAP
from gateway.permissions import IsAdminRole, IsAdminOrEmployeeRole


@pytest.mark.django_db
def test_is_admin_role_allows_admin(django_user_model):
    factory = APIRequestFactory()
    request = factory.get('/api/documents')
    admin_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[ADMIN_ROLE])
    user = django_user_model.objects.create_user(username='admin', password='pass1234')
    user.groups.add(admin_group)
    request.user = user

    assert IsAdminRole().has_permission(request, None) is True


@pytest.mark.django_db
def test_is_admin_role_denies_employee(django_user_model):
    factory = APIRequestFactory()
    request = factory.get('/api/documents')
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user = django_user_model.objects.create_user(username='emp', password='pass1234')
    user.groups.add(employee_group)
    request.user = user

    assert IsAdminRole().has_permission(request, None) is False


@pytest.mark.django_db
def test_is_admin_or_employee_allows_employee(django_user_model):
    factory = APIRequestFactory()
    request = factory.get('/api/documents')
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user = django_user_model.objects.create_user(username='emp', password='pass1234')
    user.groups.add(employee_group)
    request.user = user

    assert IsAdminOrEmployeeRole().has_permission(request, None) is True
