const API_BASE = (import.meta.env.VITE_DJANGO_API_BASE || 'http://localhost:9000/api').replace(/\/$/, '')

function buildHeaders(token, hasJson = true) {
  const headers = {}
  if (hasJson) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Token ${token}`
  return headers
}

async function request(path, { method = 'GET', token, body, hasJson = true } = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(token, hasJson),
    body: body ? (hasJson ? JSON.stringify(body) : body) : undefined,
  })

  let payload = null
  try {
    payload = await resp.json()
  } catch {
    payload = null
  }

  if (!resp.ok) {
    const detail =
      payload?.detail ||
      payload?.non_field_errors?.[0] ||
      payload?.errors?.[0] ||
      JSON.stringify(payload) ||
      `HTTP ${resp.status}`
    throw new Error(detail)
  }

  return payload
}

async function requestStream(path, { method = 'POST', token, body } = {}, onEvent) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(token, true),
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!resp.ok) {
    let payload = null
    try {
      payload = await resp.json()
    } catch {
      payload = null
    }
    const detail =
      payload?.detail ||
      payload?.non_field_errors?.[0] ||
      payload?.errors?.[0] ||
      JSON.stringify(payload) ||
      `HTTP ${resp.status}`
    throw new Error(detail)
  }

  if (!resp.body) {
    throw new Error('Streaming not supported by browser')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const lines = part.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.replace(/^data:\s*/, '').trim()
        if (!data) continue
        if (data === '[DONE]') {
          onEvent({ type: 'done' })
          continue
        }
        try {
          const payload = JSON.parse(data)
          onEvent(payload)
        } catch {
          // ignore malformed chunk
        }
      }
    }
  }
}

export const api = {
  loginAdmin: (username, password) => request('/auth/login/admin', { method: 'POST', body: { username, password } }),
  loginEmployee: (username, password) => request('/auth/login/employee', { method: 'POST', body: { username, password } }),
  me: (token) => request('/auth/me', { token }),
  ask: (token, question, top_k = 6) => request('/chat', { method: 'POST', token, body: { question, top_k } }),
  askStream: (token, question, top_k = 6, onEvent) => requestStream('/chat', { method: 'POST', token, body: { question, top_k } }, onEvent),

  getConversation: (token) => request('/conversations/current', { token }),
  saveConversation: (token, messages) => request('/conversations/current', { method: 'PUT', token, body: { messages } }),
  deleteConversation: (token) => request('/conversations/current', { method: 'DELETE', token }),

  createMessage: (token, payload) => request('/messages/', { method: 'POST', token, body: payload }),
  sendFeedback: (token, messageId, payload) => request(`/messages/${messageId}/feedback/`, { method: 'POST', token, body: payload }),
  getFeedback: (token, messageId) => request(`/messages/${messageId}/feedback/`, { token }),
  analyticsFeedback: (token) => request('/analytics/feedback', { token }),
  analyticsActivity: (token) => request('/analytics/activity', { token }),
  analyticsCounts: (token) => request('/analytics/counts', { token }),

  listDocuments: (token) => request('/documents', { token }),
  signedUrl: (token, filename, expires_in = 120) => request(`/documents/signed-url?filename=${encodeURIComponent(filename)}&expires_in=${expires_in}`, { token }),
  uploadDocument: (token, filename, content_b64) => request('/documents/upload', { method: 'POST', token, body: { filename, content_b64 } }),
  deleteDocument: (token, filename) => request(`/documents/${encodeURIComponent(filename)}`, { method: 'DELETE', token }),

  listUsers: (token) => request('/users', { token }),
  createUser: (token, payload) => request('/users', { method: 'POST', token, body: payload }),
  updateUser: (token, userId, payload) => request(`/users/${userId}`, { method: 'PATCH', token, body: payload }),
  deleteUser: (token, userId) => request(`/users/${userId}`, { method: 'DELETE', token }),
}
