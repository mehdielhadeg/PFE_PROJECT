import { useEffect, useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'

import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function FeedbackButtons({ messageId }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!messageId) return null

  useEffect(() => {
    let mounted = true
    const loadStatus = async () => {
      if (!messageId || !token) return
      try {
        await api.getFeedback(token, messageId)
        if (mounted) setSubmitted(true)
      } catch (err) {
        if (!mounted) return
        if (err.message && err.message.toLowerCase().includes('not found')) {
          setSubmitted(false)
          return
        }
      }
    }
    loadStatus()
    return () => {
      mounted = false
    }
  }, [messageId, token])

  const submit = async (isPositive) => {
    if (loading || submitted) return
    setLoading(true)
    setError('')
    try {
      await api.sendFeedback(token, messageId, { is_positive: isPositive })
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Feedback failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <button
        type="button"
        className={`flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 transition ${
          submitted ? 'opacity-50' : 'hover:border-slate-400 hover:text-white'
        }`}
        onClick={() => submit(true)}
        disabled={loading || submitted}
        aria-label="Thumbs up"
      >
        <ThumbsUp size={16} />
        Helpful
      </button>
      <button
        type="button"
        className={`flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 transition ${
          submitted ? 'opacity-50' : 'hover:border-slate-400 hover:text-white'
        }`}
        onClick={() => submit(false)}
        disabled={loading || submitted}
        aria-label="Thumbs down"
      >
        <ThumbsDown size={16} />
        Not helpful
      </button>
      {error ? <span className="ml-2 text-red-300">{error}</span> : null}
      {submitted ? <span className="ml-2 text-emerald-300">Thanks for your feedback.</span> : null}
    </div>
  )
}
