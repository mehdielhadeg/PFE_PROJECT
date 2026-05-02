import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import {
  Alert,
  Box,
  Button,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'

import Header from '../components/Header'
import FeedbackButtons from '../components/FeedbackButtons'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ── modal styles ONLY ── */
const STYLE_ID = 'chat-modal-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .chat-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px;
      animation: chat-fade .18s ease;
    }
    .chat-modal {
      width: min(420px, 92vw);
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: 18px;
      padding: 28px;
      animation: chat-rise .22s cubic-bezier(.22,.86,.44,1);
    }
    @keyframes chat-fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes chat-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

    .chat-modal-actions {
      display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px;
    }

    .chat-modal-cancel {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 9px 18px;
      border: 1px solid #CBD5E1;
      border-radius: 9px;
      background: transparent;
      color: #64748B;
      cursor: pointer;
    }
    .chat-modal-cancel:hover { background: rgba(0,0,0,.04); }

    .chat-modal-confirm {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 9px 18px;
      border: none;
      border-radius: 9px;
      background: #DC2626;
      color: #fff;
      cursor: pointer;
    }
    .chat-modal-confirm:hover { background: #B91C1C; }
  `
  document.head.appendChild(s)
}

/* warning icon */
const IconWarn = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

export default function ChatPage() {
  const { token } = useAuth()
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')

  const [phase, setPhase] = useState('idle')
  const [streamText, setStreamText] = useState('')
  const [streamSources, setStreamSources] = useState([])

  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)

  const chatRef = useRef(null)
  const bottomRef = useRef(null)
  const generating = phase !== 'idle'

  const scrollToBottom = (behavior = 'auto') => {
    const node = bottomRef.current
    if (!node) return
    node.scrollIntoView({ behavior, block: 'end' })
  }

  useLayoutEffect(() => {
    requestAnimationFrame(() => scrollToBottom('smooth'))
  }, [messages, streamText, phase])

  useEffect(() => {
    const loadConversation = async () => {
      try {
        const data = await api.getConversation(token)
        setMessages(Array.isArray(data?.messages) ? data.messages : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setHistoryLoaded(true)
      }
    }

    loadConversation()
  }, [token])

  useLayoutEffect(() => {
    if (!historyLoaded) return
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, [historyLoaded])

  useEffect(() => {
    if (!historyLoaded || generating) return

    const t = setTimeout(async () => {
      try {
        await api.saveConversation(token, messages)
      } catch {}
    }, 300)

    return () => clearTimeout(t)
  }, [messages, historyLoaded, generating, token])

  const ask = async (e) => {
    e.preventDefault()
    if (!question.trim() || generating) return

    setError('')
    const q = question.trim()

    const userMessage = { role: 'user', content: q, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMessage])
    void api.createMessage(token, { role: 'user', content: q }).catch(() => {})
    setQuestion('')
    setPhase('requesting')

    const appendAssistantMessage = async (text, sources = []) => {
      const message = { role: 'assistant', content: text, sources, created_at: new Date().toISOString() }
      try {
        const created = await api.createMessage(token, { role: 'assistant', content: text })
        message.id = created.id
      } catch {}
      setMessages((prev) => [...prev, message])
    }

    try {
      let fullText = ''
      let finalSources = []
      setStreamText('')
      setStreamSources([])

      await api.askStream(token, q, 6, (event) => {
        if (event.type === 'token') {
          setPhase('typing')
          fullText += event.text || ''
          setStreamText(fullText)
        } else if (event.type === 'sources') {
          finalSources = Array.isArray(event.sources) ? event.sources : []
          setStreamSources(finalSources)
        } else if (event.type === 'error') {
          setError(event.text || 'Streaming error')
        } else if (event.type === 'done') {
          void appendAssistantMessage(fullText, finalSources)
          setStreamText('')
          setStreamSources([])
          setPhase('idle')
        }
      })
    } catch (err) {
      setError(err.message)
      setStreamText('')
      setStreamSources([])
      setPhase('idle')
    }
  }

  const clearConversation = async () => {
    try {
      await api.deleteConversation(token)
      setMessages([])
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(e)
    }
  }

  return (
    <Header
      title="Chat"
      layout="chat"
      headerActions={
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={() => setShowClearModal(true)}
          disabled={generating || messages.length === 0}
        >
          Delete conversation
        </Button>
      }
    >
      <Box className="cg-chat-page">
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box className="cg-chat-shell">
          <Box ref={chatRef} className="cg-chat-scroll">

          {messages.length === 0 && phase === 'idle' ? (
            <Typography sx={{ opacity: 0.72 }}>Par quoi commençons-nous ?</Typography>
          ) : null}

          {messages.map((m, i) => (
            <Box key={m.id || `${m.role}-${i}`} className={`cg-msg-wrap ${m.role === 'user' ? 'user' : 'assistant'} fade-in`}>
              <Box className={`cg-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                {m.role === 'assistant' ? (
                  <Box className="md-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{m.content}</ReactMarkdown>
                  </Box>
                ) : (
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
                )}
                {m.sources?.length ? (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.74 }}>
                    Sources: {m.sources.join(', ')}
                  </Typography>
                ) : null}
                {m.role === 'assistant' ? <FeedbackButtons messageId={m.id} /> : null}
              </Box>
            </Box>
          ))}

          {phase === 'requesting' && (
            <Box className="cg-msg-wrap assistant fade-in">
              <Box className="cg-bubble assistant">
                <Box className="cg-dots"><span /><span /><span /></Box>
              </Box>
            </Box>
          )}

          {phase === 'typing' && (
            <Box className="cg-msg-wrap assistant fade-in">
              <Box className="cg-bubble assistant">
                <Box className="md-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{streamText}</ReactMarkdown>
                </Box>
                <span className="cg-cursor" />
                {streamSources.length ? (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.74 }}>
                    Sources: {streamSources.join(', ')}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          )}

          <div ref={bottomRef} />
          </Box>

          <Box component="form" className="cg-composer" onSubmit={ask}>
            <TextField
              placeholder="Poser votre question ici..."
              multiline
              minRows={1}
              maxRows={8}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onInputKeyDown}
              disabled={generating}
              fullWidth
            />
            <Button
              variant="contained"
              type="submit"
              disabled={generating || !question.trim()}
              endIcon={<SendRoundedIcon />}
              sx={{ minWidth: 120 }}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── confirm modal ── */}
      {showClearModal && (
        <div className="chat-modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#FEF2F2', border: '1px solid #FECACA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconWarn />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  Delete conversation
                </div>
                <p style={{ fontSize: 14, margin: 0, opacity: 0.8 }}>
                  This action is irreversible. All messages will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="chat-modal-actions">
              <button className="chat-modal-cancel" onClick={() => setShowClearModal(false)}>
                Cancel
              </button>
              <button
                className="chat-modal-confirm"
                onClick={async () => {
                  setShowClearModal(false)
                  await clearConversation()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Header>
  )
}