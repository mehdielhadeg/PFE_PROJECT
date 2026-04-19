import os
from urllib.parse import quote

import requests
import streamlit as st


DJANGO_API_BASE = os.getenv('DJANGO_BACKEND_URL', 'http://localhost:9000').rstrip('/') + '/api'
LIST_ENDPOINT = f'{DJANGO_API_BASE}/documents'
SIGNED_URL_ENDPOINT = f'{DJANGO_API_BASE}/documents/signed-url'
DELETE_ENDPOINT = f'{DJANGO_API_BASE}/documents'


st.set_page_config(page_title='Gestion Documents', page_icon=':file_folder:', layout='centered')
st.title('Gestion des Documents')

if 'auth_token' not in st.session_state or not st.session_state.auth_token:
    st.warning('Please login from the main page first.')
    st.stop()


def auth_headers() -> dict[str, str]:
    return {'Authorization': f"Token {st.session_state.auth_token}"}


try:
    resp = requests.get(LIST_ENDPOINT, headers=auth_headers(), timeout=60)
    if not resp.ok:
        st.error(f"Erreur chargement documents ({resp.status_code}): {resp.text}")
        st.stop()
    files = resp.json().get('files', [])
except requests.RequestException as exc:
    st.error(f'Erreur connexion backend: {exc}')
    st.stop()

if not files:
    st.info('Aucun document trouve.')
    st.stop()

st.divider()

is_admin = st.session_state.get('role') == 'admin'

for file_item in files:
    name = file_item.get('name')
    if not name:
        continue

    col_layout = [6, 2, 2] if is_admin else [7, 3]
    cols = st.columns(col_layout)

    with cols[0]:
        st.write(f'**{name}**')

    with cols[1]:
        signed_url = None
        try:
            signed_resp = requests.get(
                SIGNED_URL_ENDPOINT,
                params={'filename': name, 'expires_in': 120},
                headers=auth_headers(),
                timeout=60,
            )
            if signed_resp.ok:
                signed_url = signed_resp.json().get('url')
        except requests.RequestException:
            signed_url = None

        if signed_url:
            st.link_button('Ouvrir', signed_url)
        else:
            st.warning('Lien indisponible')

    if is_admin:
        with cols[2]:
            if st.button('Supprimer', key=f'del_{name}'):
                try:
                    del_resp = requests.delete(
                        f"{DELETE_ENDPOINT}/{quote(name, safe='')}",
                        headers=auth_headers(),
                        timeout=60,
                    )
                    if del_resp.ok:
                        st.success(f'{name} supprime.')
                        st.rerun()
                    else:
                        st.error(f"Erreur suppression ({del_resp.status_code}): {del_resp.text}")
                except requests.RequestException as exc:
                    st.error(f'Erreur connexion backend: {exc}')

    st.divider()
