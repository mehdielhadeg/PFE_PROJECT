from django.contrib.auth.models import Group
from rest_framework.permissions import BasePermission

from .constants import ROLE_GROUP_MAP, ADMIN_ROLE, EMPLOYEE_ROLE


class IsAdminRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return user.groups.filter(name=ROLE_GROUP_MAP[ADMIN_ROLE]).exists()


class IsAdminOrEmployeeRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        groups = set(user.groups.values_list('name', flat=True))
        return ROLE_GROUP_MAP[ADMIN_ROLE] in groups or ROLE_GROUP_MAP[EMPLOYEE_ROLE] in groups
