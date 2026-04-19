import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'

import Header from '../components/Header'
import FeedbackButtons from '../components/FeedbackButtons'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fileToBase64 } from '../utils/base64'


export default function ChatPage() {
  const { token, role } = useAuth()
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [error, setError] = useState('')

  const [phase, setPhase] = useState('idle')
  const [streamText, setStreamText] = useState('')
  const [streamSources, setStreamSources] = useState([])

  const [historyLoaded, setHistoryLoaded] = useState(false)

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
      } catch {
        // non-blocking persistence failure
      }
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
      } catch {
        // feedback is optional, so skip if creation fails
      }
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

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')

    for (const file of files) {
      try {
        setUploadStatus(`Processing ${file.name}...`)
        const content_b64 = await fileToBase64(file)
        const data = await api.uploadDocument(token, file.name, content_b64)

        if (data.status === 'Duplicate') {
          setUploadStatus(`Duplicate: ${file.name} (skipped)`)
        } else {
          setUploadStatus(`Indexed: ${file.name} (${data.indexed_chunks || 0} chunks)`)
        }
      } catch (err) {
        setError(err.message)
      }
    }

    setTimeout(() => setUploadStatus(''), 1200)
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(e)
    }
  }

  const sidebarExtra = role === 'admin' ? (
    <Stack spacing={1.2}>
      <Typography variant="subtitle2">Upload documents</Typography>
      <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />}>
        Select files
        <input hidden type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={onUpload} />
      </Button>
      {uploadStatus ? <Typography variant="caption" sx={{ color: '#a8f3c2' }}>{uploadStatus}</Typography> : null}
    </Stack>
  ) : (
    <Typography variant="caption" sx={{ opacity: 0.76 }}>
      Employee mode: upload disabled.
    </Typography>
  )

  return (
    <Header
      title="Chat"
      layout="chat"
      sidebarExtra={sidebarExtra}
      headerActions={
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={clearConversation}
          disabled={generating}
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
            <Typography sx={{ opacity: 0.72 }}>Start a conversation.</Typography>
          ) : null}

          {messages.map((m, i) => (
            <Box key={`${m.role}-${i}`} className={`cg-msg-wrap ${m.role === 'user' ? 'user' : 'assistant'} fade-in`}>
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

          {phase === 'requesting' ? (
            <Box className="cg-msg-wrap assistant fade-in">
              <Box className="cg-bubble assistant">
                <Box className="cg-dots" aria-label="thinking">
                  <span />
                  <span />
                  <span />
                </Box>
              </Box>
            </Box>
          ) : null}

          {phase === 'typing' ? (
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
          ) : null}
          <div ref={bottomRef} />
          </Box>

          <Box component="form" className="cg-composer" onSubmit={ask}>
          <TextField
            placeholder="Message RAG Assistant..."
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
    </Header>
  )
}
