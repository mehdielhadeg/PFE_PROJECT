from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from gateway.constants import ROLE_GROUP_MAP, ADMIN_ROLE, EMPLOYEE_ROLE


class Command(BaseCommand):
    help = 'Create default roles and default users for local development.'

    def add_arguments(self, parser):
        parser.add_argument('--admin-username', default='admin')
        parser.add_argument('--admin-password', default='admin1234')
        parser.add_argument('--employee-username', default='employee')
        parser.add_argument('--employee-password', default='employee1234')

    def handle(self, *args, **options):
        admin_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[ADMIN_ROLE])
        employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])

        admin_user, admin_created = User.objects.get_or_create(
            username=options['admin_username'],
            defaults={'is_staff': True},
        )
        if admin_created:
            admin_user.set_password(options['admin_password'])
            admin_user.save()
        admin_user.groups.add(admin_group)

        employee_user, employee_created = User.objects.get_or_create(
            username=options['employee_username']
        )
        if employee_created:
            employee_user.set_password(options['employee_password'])
            employee_user.save()
        employee_user.groups.add(employee_group)

        self.stdout.write(self.style.SUCCESS('Roles and default users are ready.'))
