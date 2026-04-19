import pytest


@pytest.mark.django_db
def test_users_requires_admin(employee_client):
    resp = employee_client.get('/api/users')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_users_crud_admin(admin_client):
    resp = admin_client.post(
        '/api/users',
        {'username': 'int_user', 'password': 'pass1234', 'role': 'employee'},
        format='json',
    )
    assert resp.status_code == 201
    user_id = resp.data['id']

    resp = admin_client.patch(
        f'/api/users/{user_id}',
        {'username': 'int_user2'},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['username'] == 'int_user2'

    resp = admin_client.delete(f'/api/users/{user_id}')
    assert resp.status_code == 204
