import pytest
from django.contrib.auth.models import Group

from gateway.constants import ADMIN_ROLE, EMPLOYEE_ROLE, ROLE_GROUP_MAP
from gateway.serializers import LoginSerializer


@pytest.mark.django_db
def test_login_serializer_invalid_credentials():
    serializer = LoginSerializer(
        data={'username': 'nope', 'password': 'bad'},
        context={'role': ADMIN_ROLE},
    )
    assert not serializer.is_valid()
    assert 'Incorrect username or password' in str(serializer.errors)


@pytest.mark.django_db
def test_login_serializer_role_mismatch(django_user_model):
    user = django_user_model.objects.create_user(username='emp', password='pass1234')
    Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])
    user.groups.add(Group.objects.get(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE]))

    serializer = LoginSerializer(
        data={'username': 'emp', 'password': 'pass1234'},
        context={'role': ADMIN_ROLE},
    )
    assert not serializer.is_valid()
    assert 'admin access' in str(serializer.errors)
