import base64
import os
import time
from typing import Any

import requests
import streamlit as st


DJANGO_API_BASE = os.getenv('DJANGO_BACKEND_URL', 'http://localhost:9000').rstrip('/') + '/api'
LOGIN_ADMIN_URL = f'{DJANGO_API_BASE}/auth/login/admin'
LOGIN_EMPLOYEE_URL = f'{DJANGO_API_BASE}/auth/login/employee'
CHAT_URL = f'{DJANGO_API_BASE}/chat'
UPLOAD_URL = f'{DJANGO_API_BASE}/documents/upload'


def _init_session() -> None:
    defaults = {
        'auth_token': '',
        'role': '',
        'username': '',
        'messages': [],
        'active_chunks': 0,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _logout() -> None:
    for key in ['auth_token', 'role', 'username', 'messages', 'active_chunks']:
        st.session_state[key] = '' if key in ['auth_token', 'role', 'username'] else [] if key == 'messages' else 0
    st.rerun()


def _auth_headers() -> dict[str, str]:
    return {'Authorization': f"Token {st.session_state.auth_token}"}


def _render_login() -> None:
    st.title('Connexion')
    st.caption('Backend Django orchestrator: ' + DJANGO_API_BASE)

    tab_admin, tab_employee = st.tabs(['Admin Login', 'Employee Login'])

    with tab_admin:
        with st.form('admin_login_form'):
            username = st.text_input('Admin username', key='admin_username')
            password = st.text_input('Admin password', type='password', key='admin_password')
            submit = st.form_submit_button('Login as Admin')

            if submit:
                try:
                    resp = requests.post(
                        LOGIN_ADMIN_URL,
                        json={'username': username, 'password': password},
                        timeout=30,
                    )
                    if resp.ok:
                        data = resp.json()
                        st.session_state.auth_token = data['token']
                        st.session_state.role = data['role']
                        st.session_state.username = data['username']
                        st.rerun()
                    else:
                        st.error(f'Login failed: {resp.text}')
                except requests.RequestException as exc:
                    st.error(f'Backend error: {exc}')

    with tab_employee:
        with st.form('employee_login_form'):
            username = st.text_input('Employee username', key='employee_username')
            password = st.text_input('Employee password', type='password', key='employee_password')
            submit = st.form_submit_button('Login as Employee')

            if submit:
                try:
                    resp = requests.post(
                        LOGIN_EMPLOYEE_URL,
                        json={'username': username, 'password': password},
                        timeout=30,
                    )
                    if resp.ok:
                        data = resp.json()
                        st.session_state.auth_token = data['token']
                        st.session_state.role = data['role']
                        st.session_state.username = data['username']
                        st.rerun()
                    else:
                        st.error(f'Login failed: {resp.text}')
                except requests.RequestException as exc:
                    st.error(f'Backend error: {exc}')


_init_session()
st.set_page_config(page_title='RAG ChatBot', page_icon=':hospital:', layout='centered')

if not st.session_state.auth_token:
    _render_login()
    st.stop()

st.title('RAG ChatBot - Mode Conversation')

with st.sidebar:
    st.write(f"Connected as: **{st.session_state.username}**")
    st.write(f"Role: **{st.session_state.role}**")

    if st.button('Logout', type='secondary'):
        _logout()

    st.divider()

    if st.session_state.role == 'admin':
        st.header('Gestion des Documents')
        uploads = st.file_uploader(
            'Uploader vers le Cloud & Indexer',
            type=['pdf', 'png', 'jpg', 'jpeg'],
            accept_multiple_files=True,
        )

        if uploads:
            for upload in uploads:
                with st.spinner(f'Traitement de {upload.name}...'):
                    try:
                        content_b64 = base64.b64encode(upload.getvalue()).decode('utf-8')
                        resp = requests.post(
                            UPLOAD_URL,
                            json={'filename': upload.name, 'content_b64': content_b64},
                            headers=_auth_headers(),
                            timeout=180,
                        )

                        if not resp.ok:
                            st.error(f"Upload failed ({resp.status_code}): {resp.text}")
                            continue

                        data: dict[str, Any] = resp.json()
                        if data.get('status') == 'Duplicate':
                            st.warning(f"Le document '{upload.name}' existe deja. Ingestion annulee.")
                            continue

                        indexed = int(data.get('indexed_chunks', 0))
                        st.session_state.active_chunks += indexed
                        st.success(f"{upload.name} indexe avec succes")
                    except requests.RequestException as exc:
                        st.error(f'Backend error: {exc}')
    else:
        st.info('Employee role: upload/delete disabled. You can chat and view documents.')

    st.divider()

    if st.button('Effacer la discussion', type='secondary'):
        st.session_state.messages = []
        st.rerun()

    st.caption(f'Chunks indexes (session): {st.session_state.active_chunks}')

for msg in st.session_state.messages:
    with st.chat_message(msg['role']):
        st.markdown(msg['content'])
        if msg.get('sources'):
            with st.expander('Sources consultees'):
                for source in msg['sources']:
                    st.write(f'- {source}')

if question := st.chat_input('Posez votre question...'):
    st.session_state.messages.append({'role': 'user', 'content': question})

    with st.chat_message('user'):
        st.markdown(question)

    with st.chat_message('assistant'):
        with st.spinner('Reflexion en cours...'):
            answer = 'Erreur backend'
            sources: list[str] = []

            try:
                resp = requests.post(
                    CHAT_URL,
                    json={'question': question, 'top_k': 6},
                    headers=_auth_headers(),
                    timeout=180,
                )
                if resp.ok:
                    payload: dict[str, Any] = resp.json()
                    answer = payload.get('answer', '') or 'Aucune reponse'
                    sources = payload.get('sources', []) or []
                else:
                    answer = f'Erreur chat ({resp.status_code}): {resp.text}'
            except requests.RequestException as exc:
                answer = f'Erreur connexion backend: {exc}'

        placeholder = st.empty()
        full_response = ''
        for word in answer.split(' '):
            full_response += word + ' '
            placeholder.markdown(full_response + '|')
            time.sleep(0.015)
        placeholder.markdown(full_response)

        if sources:
            with st.expander('Sources utilisees'):
                for source in sources:
                    st.write(f'- {source}')

    st.session_state.messages.append({'role': 'assistant', 'content': answer, 'sources': sources})
