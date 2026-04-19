import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from gateway.constants import ADMIN_ROLE, EMPLOYEE_ROLE, ROLE_GROUP_MAP


@pytest.mark.django_db
def test_login_admin_success(django_user_model):
    admin_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[ADMIN_ROLE])
    user = django_user_model.objects.create_user(username='admin', password='pass1234')
    user.groups.add(admin_group)

    client = APIClient()
    resp = client.post('/api/auth/login/admin', {'username': 'admin', 'password': 'pass1234'}, format='json')
    assert resp.status_code == 200
    assert resp.data['role'] == ADMIN_ROLE
    assert resp.data['username'] == 'admin'
    assert 'token' in resp.data


@pytest.mark.django_db
def test_login_admin_rejects_employee(django_user_model):
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user = django_user_model.objects.create_user(username='emp', password='pass1234')
    user.groups.add(employee_group)

    client = APIClient()
    resp = client.post('/api/auth/login/admin', {'username': 'emp', 'password': 'pass1234'}, format='json')
    assert resp.status_code == 400
    assert 'admin access' in str(resp.data)


@pytest.mark.django_db
def test_login_employee_success(django_user_model):
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user = django_user_model.objects.create_user(username='emp', password='pass1234')
    user.groups.add(employee_group)

    client = APIClient()
    resp = client.post('/api/auth/login/employee', {'username': 'emp', 'password': 'pass1234'}, format='json')
    assert resp.status_code == 200
    assert resp.data['role'] == EMPLOYEE_ROLE
    assert resp.data['username'] == 'emp'
    assert 'token' in resp.data
