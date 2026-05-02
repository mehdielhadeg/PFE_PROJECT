import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/* ── inject styles once ── */
const STYLE_ID = 'emp-login-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

    .elp-root {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: #0D0F14;
      font-family: 'DM Sans', sans-serif;
      padding: 24px;
      position: relative; overflow: hidden;
    }
    .elp-root::before {
      content: '';
      position: absolute;
      width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(16,185,129,.11) 0%, transparent 65%);
      top: -200px; left: 50%; transform: translateX(-50%);
      pointer-events: none;
    }

    .elp-card {
      width: 100%; max-width: 420px;
      background: #141720;
      border: 1px solid #1E2433;
      border-radius: 20px;
      padding: 36px 32px;
      position: relative; z-index: 1;
      animation: elp-rise .48s cubic-bezier(.22,.86,.44,1) both;
    }
    @keyframes elp-rise {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: none; }
    }

    .elp-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(16,185,129,.1);
      border: 1px solid rgba(16,185,129,.2);
      border-radius: 99px;
      padding: 5px 14px 5px 8px;
      font-size: 11px; font-weight: 500;
      color: #34D399; letter-spacing: .04em;
      margin-bottom: 20px;
    }
    .elp-badge-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #10B981; box-shadow: 0 0 6px #10B981;
    }

    .elp-title {
      font-family: 'Syne', sans-serif;
      font-size: 28px; font-weight: 700;
      color: #F1F5F9; margin: 0 0 6px;
      letter-spacing: -.025em; line-height: 1.2;
    }
    .elp-subtitle { font-size: 14px; color: #475569; margin: 0 0 28px; }

    .elp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .elp-label {
      font-size: 11px; font-weight: 500; color: #475569;
      letter-spacing: .07em; text-transform: uppercase;
      display: flex; align-items: center; gap: 5px;
    }
    .elp-input {
      width: 100%; box-sizing: border-box;
      background: #0D0F14; border: 1px solid #1E2433; border-radius: 10px;
      padding: 11px 14px;
      font-family: 'DM Sans', sans-serif; font-size: 14px; color: #E2E8F0;
      outline: none; transition: border-color .18s, box-shadow .18s;
    }
    .elp-input::placeholder { color: #2D3A50; }
    .elp-input:focus {
      border-color: #065F46;
      box-shadow: 0 0 0 3px rgba(16,185,129,.12);
    }

    .elp-btn {
      width: 100%; margin-top: 6px; padding: 12px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
      font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
      color: #022c22; cursor: pointer;
      box-shadow: 0 4px 20px rgba(16,185,129,.28);
      transition: opacity .15s, transform .15s, box-shadow .15s;
    }
    .elp-btn:hover  { opacity: .9; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(16,185,129,.38); }
    .elp-btn:active { opacity: 1; transform: none; }

    .elp-footer {
      margin-top: 20px; padding-top: 18px;
      border-top: 1px solid #1E2433;
      font-size: 13px; color: #475569; text-align: center;
    }
    .elp-footer a { color: #34D399; text-decoration: none; transition: color .15s; }
    .elp-footer a:hover { color: #6EE7B7; }

    .elp-error {
      display: flex; align-items: center; gap: 8px;
      background: rgba(239,68,68,.09); border: 1px solid rgba(239,68,68,.22);
      border-radius: 10px; padding: 10px 14px;
      font-size: 13px; color: #FCA5A5; margin-bottom: 18px;
    }
  `
  document.head.appendChild(s)
}

const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconAtSign = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
  </svg>
)
const IconLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

export default function EmployeeLoginPage() {
  const { loginEmployee } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await loginEmployee(form.username, form.password)
      navigate('/chat')
    } catch (err) {
      setError(err.message || 'Identifiants incorrects')
    }
  }

  return (
    <div className="elp-root">
      <div className="elp-card">
        <div className="elp-badge">
          <div className="elp-badge-dot" />
          Espace Employé
        </div>

        <h1 className="elp-title">Connexion</h1>
        <p className="elp-subtitle">Accès réservé aux employés</p>

        {error && (
          <div className="elp-error">
            <IconAlert /> {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="elp-field">
            <label className="elp-label"><IconAtSign /> Identifiant</label>
            <input
              className="elp-input"
              placeholder="Votre identifiant"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
            />
          </div>
          <div className="elp-field">
            <label className="elp-label"><IconLock /> Mot de passe</label>
            <input
              className="elp-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          <button className="elp-btn" type="submit">
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <IconUser /> Accéder à l'espace employé
            </span>
          </button>
        </form>

        <div className="elp-footer">
          Accès administrateur ?{' '}
          <Link to="/login/admin">Connexion admin →</Link>
        </div>
      </div>
    </div>
  )
}