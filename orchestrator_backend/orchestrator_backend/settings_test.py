from .settings import *  # noqa: F401,F403


# Tests must never connect to the real configured Postgres/Supabase database.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'test_db.sqlite3',  # noqa: F405
    }
}
