import json
from datetime import datetime, timedelta
from urllib.parse import quote

import pika
import requests
from django.http import StreamingHttpResponse
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from supabase import create_client

from .constants import ADMIN_ROLE, EMPLOYEE_ROLE, ROLE_GROUP_MAP
from .permissions import IsAdminRole, IsAdminOrEmployeeRole
from .models import ChatMessage, Feedback
from .repositories import DocumentRepository
from .serializers import (
    ChatSerializer,
    ConversationSaveSerializer,
    DocumentAdminSerializer,
    DocumentEmployeeSerializer,
    DocumentUploadSerializer,
    LoginSerializer,
    UserCreateSerializer,
    UserOutSerializer,
    UserUpdateSerializer,
    ChatMessageCreateSerializer,
    FeedbackCreateSerializer,
    FeedbackOutSerializer,
)

REQUEST_TIMEOUT = 180
_supabase_client = None


def _service_error(prefix: str, exc: Exception, code: int = status.HTTP_502_BAD_GATEWAY) -> Response:
    return Response({'detail': f'{prefix}: {exc}'}, status=code)


def _resolve_role(user: User) -> str:
    groups = set(user.groups.values_list('name', flat=True))
    if user.is_superuser or ROLE_GROUP_MAP[ADMIN_ROLE] in groups:
        return ADMIN_ROLE
    return EMPLOYEE_ROLE


def _set_user_role(user: User, role: str) -> None:
    admin_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[ADMIN_ROLE])
    employee_group, _ = Group.objects.get_or_create(name=ROLE_GROUP_MAP[EMPLOYEE_ROLE])

    user.groups.remove(admin_group, employee_group)
    target_group = admin_group if role == ADMIN_ROLE else employee_group
    user.groups.add(target_group)


def _supabase_or_error() -> tuple[object | None, Response | None]:
    global _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None, Response(
            {'detail': 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    return _supabase_client, None


def _document_repo_or_error() -> tuple[DocumentRepository | None, Response | None]:
    supabase_client, error_response = _supabase_or_error()
    if error_response:
        return None, error_response

    return DocumentRepository(
        supabase_client=supabase_client,
        table_name=settings.SUPABASE_DOCUMENTS_TABLE,
        bucket_name=settings.SUPABASE_BUCKET,
    ), None


def _enqueue(filename: str, content_b64: str, uploaded_by: str) -> None:
    connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue='upload_queue', durable=True)
    payload = json.dumps(
        {
            'filename': filename,
            'content_b64': content_b64,
            'uploaded_by': uploaded_by,
        }
    )
    channel.basic_publish(
        exchange='',
        routing_key='upload_queue',
        body=payload,
        properties=pika.BasicProperties(delivery_mode=2),
    )
    connection.close()


class ChatMessageViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminOrEmployeeRole]

    def create(self, request):
        serializer = ChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ChatMessage.objects.create(
            user=request.user,
            role=serializer.validated_data['role'],
            content=serializer.validated_data['content'],
        )
        return Response(ChatMessageCreateSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='feedback')
    def feedback(self, request, pk=None):
        try:
            message = ChatMessage.objects.get(pk=pk)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        if message.user_id != request.user.id and _resolve_role(request.user) != ADMIN_ROLE:
            return Response({'detail': 'You cannot leave feedback for this message.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            if not hasattr(message, 'feedback'):
                return Response({'detail': 'Feedback not found.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(FeedbackOutSerializer(message.feedback).data)

        if hasattr(message, 'feedback'):
            return Response({'detail': 'Feedback already submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback = serializer.save(message=message)
        return Response(
            {'status': 'success', 'feedback': FeedbackOutSerializer(feedback).data},
            status=status.HTTP_201_CREATED,
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_admin(request):
    serializer = LoginSerializer(data=request.data, context={'request': request, 'role': ADMIN_ROLE})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'role': ADMIN_ROLE, 'username': user.username})


@api_view(['POST'])
@permission_classes([AllowAny])
def login_employee(request):
    serializer = LoginSerializer(data=request.data, context={'request': request, 'role': EMPLOYEE_ROLE})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'role': EMPLOYEE_ROLE, 'username': user.username})


@api_view(['GET'])
@permission_classes([IsAdminOrEmployeeRole])
def me(request):
    return Response({'username': request.user.username, 'role': _resolve_role(request.user)})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminRole])
def users_collection(request):
    if request.method == 'GET':
        users = User.objects.all().order_by('id')
        data = [{'id': u.id, 'username': u.username, 'role': _resolve_role(u)} for u in users]
        return Response(UserOutSerializer(data, many=True).data)

    serializer = UserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = User.objects.create_user(
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )
    _set_user_role(user, serializer.validated_data['role'])

    out = UserOutSerializer({'id': user.id, 'username': user.username, 'role': _resolve_role(user)}).data
    return Response(out, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
def users_item(request, user_id: int):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method in ['PUT', 'PATCH']:
        partial = request.method == 'PATCH'
        serializer = UserUpdateSerializer(data=request.data, partial=partial, context={'user_id': user.id})
        serializer.is_valid(raise_exception=True)

        if 'username' in serializer.validated_data:
            user.username = serializer.validated_data['username']
        if 'password' in serializer.validated_data:
            user.set_password(serializer.validated_data['password'])
        user.save()

        if 'role' in serializer.validated_data:
            if user.id == request.user.id and serializer.validated_data['role'] != ADMIN_ROLE:
                return Response({'detail': 'You cannot remove your own admin role.'}, status=status.HTTP_400_BAD_REQUEST)
            _set_user_role(user, serializer.validated_data['role'])

        out = UserOutSerializer({'id': user.id, 'username': user.username, 'role': _resolve_role(user)}).data
        return Response(out)

    if user.id == request.user.id:
        return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAdminOrEmployeeRole])
def conversations_current(request):
    supabase_client, error_response = _supabase_or_error()
    if error_response:
        return error_response

    table = settings.SUPABASE_CONVERSATIONS_TABLE
    user_key = str(request.user.id)

    if request.method == 'GET':
        try:
            result = supabase_client.table(table).select('messages').eq('user_id', user_key).limit(1).execute()
            row = result.data[0] if result.data else None
            return Response({'messages': row.get('messages', []) if row else []})
        except Exception as exc:
            return _service_error('Conversation load error', exc)

    if request.method == 'PUT':
        serializer = ConversationSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            supabase_client.table(table).upsert(
                {'user_id': user_key, 'messages': serializer.validated_data['messages']},
                on_conflict='user_id',
            ).execute()
            return Response({'status': 'saved'})
        except Exception as exc:
            return _service_error('Conversation save error', exc)

    try:
        supabase_client.table(table).delete().eq('user_id', user_key).execute()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        return _service_error('Conversation delete error', exc)


@api_view(['POST'])
@permission_classes([IsAdminOrEmployeeRole])
def chat(request):
    serializer = ChatSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payload = serializer.validated_data
    try:
        resp = requests.post(
            f"{settings.MICRO_LLM_URL}/ask",
            json=payload,
            timeout=REQUEST_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        return _service_error('LLM service error', exc)

    def event_stream():
        for line in resp.iter_lines(decode_unicode=True):
            if not line:
                continue
            yield f"{line}\n\n"

    return StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


@api_view(['GET'])
@permission_classes([IsAdminOrEmployeeRole])
def documents_list(request):
    repo, error_response = _document_repo_or_error()
    if error_response:
        return error_response

    try:
        raw_docs = repo.list_documents()
        role = _resolve_role(request.user)

        if role == ADMIN_ROLE:
            admin_payload = []
            for d in raw_docs:
                admin_payload.append(
                    {
                        'name': d.get('name', ''),
                        'uploaded_by': d.get('uploaded_by', ''),
                        'upload_date': d.get('upload_date', ''),
                        'open': repo.get_signed_url(d.get('name', '')),
                        'delete': True,
                    }
                )
            serializer = DocumentAdminSerializer(admin_payload, many=True)
            return Response({'documents': serializer.data})

        employee_payload = []
        for d in raw_docs:
            employee_payload.append({'name': d.get('name', ''), 'open': repo.get_signed_url(d.get('name', ''))})

        serializer = DocumentEmployeeSerializer(employee_payload, many=True)
        return Response({'documents': serializer.data})
    except Exception as exc:
        return _service_error('Document list error', exc)


@api_view(['GET'])
@permission_classes([IsAdminOrEmployeeRole])
def documents_signed_url(request):
    filename = request.query_params.get('filename', '').strip()
    if not filename:
        return Response({'detail': 'filename is required'}, status=status.HTTP_400_BAD_REQUEST)

    repo, error_response = _document_repo_or_error()
    if error_response:
        return error_response

    expires_in = int(request.query_params.get('expires_in', '120'))
    try:
        url = repo.get_signed_url(filename, expires_in)
        if not url:
            return Response({'detail': 'Signed URL unavailable'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'url': url})
    except Exception as exc:
        return _service_error('Document signed URL error', exc)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def documents_upload(request):
    serializer = DocumentUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    filename = serializer.validated_data['filename']
    content_b64 = serializer.validated_data['content_b64']

    try:
        upload_resp = requests.post(
            f"{settings.MICRO_INGESTION_URL}/documents/upload",
            json={'filename': filename, 'content_b64': content_b64},
            timeout=REQUEST_TIMEOUT,
        )
        upload_resp.raise_for_status()
    except requests.RequestException as exc:
        return _service_error('Cloud upload error', exc)

    upload_data = upload_resp.json()
    if upload_data.get('status') == 'Duplicate':
        try:
            repo, error_response = _document_repo_or_error()
            if error_response:
                return error_response
            repo.upsert_document(name=filename, uploaded_by=request.user.username)
        except Exception as exc:
            return _service_error('Document metadata save error', exc)
        return Response({'status': 'Duplicate', 'filename': filename, 'indexed_chunks': 0}, status=status.HTTP_200_OK)

    if not upload_data.get('success'):
        return Response(upload_data, status=status.HTTP_400_BAD_REQUEST)

    try:
        repo, error_response = _document_repo_or_error()
        if error_response:
            return error_response
        repo.upsert_document(name=filename, uploaded_by=request.user.username)
        _enqueue(filename, content_b64, request.user.username)
    except Exception as exc:
        return _service_error('Queue enqueue or metadata save error', exc)

    return Response({'status': 'Processing', 'filename': filename}, status=status.HTTP_202_ACCEPTED)


@api_view(['DELETE'])
@permission_classes([IsAdminRole])
def documents_delete(request, filename: str):
    safe_name = quote(filename, safe='')
    try:
        cloud_resp = requests.delete(f"{settings.MICRO_INGESTION_URL}/documents/{safe_name}", timeout=60)
        cloud_resp.raise_for_status()

        index_resp = requests.post(
            f"{settings.MICRO_INDEXING_URL}/index/delete",
            json={'source': filename},
            timeout=60,
        )
        index_resp.raise_for_status()

        repo, error_response = _document_repo_or_error()
        if error_response:
            return error_response
        repo.delete_document(filename)
    except requests.RequestException as exc:
        return _service_error('Delete orchestration error', exc)
    except Exception as exc:
        return _service_error('Document metadata delete error', exc)

    return Response({'deleted': filename})


@api_view(['GET'])
@permission_classes([IsAdminRole])
def analytics_feedback(request):
    total_assistant = ChatMessage.objects.filter(role='assistant').count()
    up_count = Feedback.objects.filter(is_positive=True).count()
    down_count = Feedback.objects.filter(is_positive=False).count()
    feedback_total = up_count + down_count
    none_count = max(total_assistant - feedback_total, 0)

    satisfaction = round((up_count / feedback_total) * 100, 2) if feedback_total else 0.0

    negatives = Feedback.objects.filter(is_positive=False).order_by('-created_at')[:5]
    items = []
    for fb in negatives:
        message = fb.message
        question = ChatMessage.objects.filter(
            user=message.user,
            role='user',
            created_at__lte=message.created_at,
        ).order_by('-created_at').first()
        items.append(
            {
                'message_id': str(message.id),
                'question': question.content if question else None,
                'answer_excerpt': (message.content or '')[:240],
                'answer': message.content,
                'created_at': fb.created_at.isoformat(),
            }
        )

    return Response(
        {
            'satisfaction_rate': satisfaction,
            'counts': {
                'thumbs_up': up_count,
                'thumbs_down': down_count,
                'no_feedback': none_count,
                'total': total_assistant,
            },
            'latest_negatives': items,
        }
    )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def analytics_counts(request):
    try:
        users_total = User.objects.count()
    except Exception as exc:
        return _service_error('Users count error', exc)

    repo, error_response = _document_repo_or_error()
    if error_response:
        return error_response

    try:
        documents_total = len(repo.list_documents())
    except Exception as exc:
        return _service_error('Documents count error', exc)

    return Response(
        {
            'users_total': users_total,
            'documents_total': documents_total,
        }
    )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def analytics_activity(request):
    today = timezone.now().date()
    start_current = today - timedelta(days=29)
    start_previous = start_current - timedelta(days=30)
    end_previous = start_current - timedelta(days=1)

    current_qs = ChatMessage.objects.filter(role='user', created_at__date__gte=start_current)
    prev_qs = ChatMessage.objects.filter(
        role='user',
        created_at__date__gte=start_previous,
        created_at__date__lte=end_previous,
    )

    current_total = current_qs.count()
    prev_total = prev_qs.count()
    if prev_total == 0:
        change_pct = 100.0 if current_total > 0 else 0.0
    else:
        change_pct = round(((current_total - prev_total) / prev_total) * 100, 2)

    daily = (
        current_qs.annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    daily_series = [
        {'date': row['day'].isoformat(), 'count': row['count']}
        for row in daily
        if row['day']
    ]

    # Optional: enrich from Supabase conversation history if available.
    def _parse_iso(value: str | None):
        if not value:
            return None
        try:
            text = value.replace('Z', '+00:00')
            return datetime.fromisoformat(text)
        except ValueError:
            return None

    supabase_client, error_response = _supabase_or_error()
    if not error_response:
        try:
            result = supabase_client.table(settings.SUPABASE_CONVERSATIONS_TABLE).select('messages').execute()
            sup_total = 0
            sup_current = 0
            sup_prev = 0
            daily_counts = {}
            has_timestamps = False

            for row in result.data or []:
                for msg in row.get('messages') or []:
                    if msg.get('role') != 'user':
                        continue
                    sup_total += 1
                    dt = _parse_iso(msg.get('created_at'))
                    if not dt:
                        continue
                    has_timestamps = True
                    dt_date = dt.date()
                    if dt_date >= start_current:
                        sup_current += 1
                    elif start_previous <= dt_date <= end_previous:
                        sup_prev += 1
                    daily_counts[dt_date] = daily_counts.get(dt_date, 0) + 1

            if has_timestamps:
                current_total = max(current_total, sup_current)
                prev_total = max(prev_total, sup_prev)
                daily_series = [
                    {'date': day.isoformat(), 'count': count}
                    for day, count in sorted(daily_counts.items())
                    if day >= start_current
                ]
            else:
                # Only improve totals if Supabase has more messages (no dates available).
                current_total = max(current_total, sup_total)
        except Exception:
            pass

    if prev_total == 0:
        change_pct = 100.0 if current_total > 0 else 0.0
    else:
        change_pct = round(((current_total - prev_total) / prev_total) * 100, 2)

    return Response(
        {
            'last_30_days_total': current_total,
            'change_pct': change_pct,
            'daily': daily_series,
        }
    )
