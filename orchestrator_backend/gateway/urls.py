from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('messages', views.ChatMessageViewSet, basename='messages')

urlpatterns = [
    path('auth/login/admin', views.login_admin),
    path('auth/login/employee', views.login_employee),
    path('auth/me', views.me),

    path('users', views.users_collection),
    path('users/<int:user_id>', views.users_item),

    path('conversations/current', views.conversations_current),

    path('chat', views.chat),
    path('documents', views.documents_list),
    path('documents/signed-url', views.documents_signed_url),
    path('documents/upload', views.documents_upload),
    path('documents/<path:filename>', views.documents_delete),
    path('analytics/feedback', views.analytics_feedback),
    path('analytics/activity', views.analytics_activity),
    path('analytics/counts', views.analytics_counts),

    path('', include(router.urls)),
]
