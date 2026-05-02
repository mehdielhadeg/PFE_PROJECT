import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = os.getenv('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = [h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'gateway',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'orchestrator_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'orchestrator_backend.wsgi.application'
ASGI_APPLICATION = 'orchestrator_backend.asgi.application'

DATABASE_URL = os.getenv('DATABASE_URL', '').strip()

if DATABASE_URL:
    # Single source of truth for DB config.
    # Example:
    # DATABASE_URL=postgresql://postgres.xxxxx:password@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme not in ('postgresql', 'postgres'):
        raise ValueError('DATABASE_URL must use postgresql:// or postgres://')
    qs = parse_qs(parsed.query)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': (parsed.path or '/postgres').lstrip('/'),
            'USER': unquote(parsed.username or ''),
            'PASSWORD': unquote(parsed.password or ''),
            'HOST': parsed.hostname or '',
            'PORT': str(parsed.port or 5432),
            'OPTIONS': {
                'sslmode': (qs.get('sslmode', ['require'])[0] or 'require'),
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]

MICRO_INGESTION_URL = os.getenv('INGESTION_SERVICE_URL', 'http://localhost:8001').rstrip('/')
MICRO_INDEXING_URL = os.getenv('INDEXING_SERVICE_URL', 'http://localhost:8002').rstrip('/')
MICRO_LLM_URL = os.getenv('LLM_SERVICE_URL', 'http://localhost:8003').rstrip('/')
RABBITMQ_URL = 'amqp://guest:guest@rabbitmq:5672/'
#RABBITMQ_URL = 'amqp://guest:guest@localhost:5672/'

SUPABASE_URL = os.getenv('SUPABASE_URL', '').strip()
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '').strip()
SUPABASE_CONVERSATIONS_TABLE = os.getenv('SUPABASE_CONVERSATIONS_TABLE', 'conversation_sessions').strip()
SUPABASE_DOCUMENTS_TABLE = os.getenv('SUPABASE_DOCUMENTS_TABLE', 'document_records').strip()
SUPABASE_BUCKET = os.getenv('SUPABASE_BUCKET', 'rag-docs').strip()
