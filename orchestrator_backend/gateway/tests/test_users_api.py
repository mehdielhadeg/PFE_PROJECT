import pytest


@pytest.mark.django_db
def test_users_list_admin_ok(admin_client):
    resp = admin_client.get('/api/users')
    assert resp.status_code == 200
    assert isinstance(resp.data, list)


@pytest.mark.django_db
def test_users_list_employee_forbidden(employee_client):
    resp = employee_client.get('/api/users')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_users_create_update_delete_flow(admin_client):
    # Create
    resp = admin_client.post(
        '/api/users',
        {'username': 'new_user', 'password': 'pass1234', 'role': 'employee'},
        format='json',
    )
    assert resp.status_code == 201
    user_id = resp.data['id']

    # Update username
    resp = admin_client.patch(
        f'/api/users/{user_id}',
        {'username': 'renamed_user'},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['username'] == 'renamed_user'

    # Promote role
    resp = admin_client.patch(
        f'/api/users/{user_id}',
        {'role': 'admin'},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['role'] == 'admin'

    # Delete
    resp = admin_client.delete(f'/api/users/{user_id}')
    assert resp.status_code == 204
