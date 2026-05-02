import { useEffect, useState } from 'react'
import {
  Alert,
  MenuItem,
  TextField,
} from '@mui/material'
import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
 
/* ── inject structural/layout styles only ── */
const STYLE_ID = 'users-page-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    .up-root { font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; gap: 12px; }
    .up-card { background: var(--color-background-primary); border: 1px solid var(--color-border-tertiary); border-radius: 14px; overflow: hidden; }
    .up-card-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--color-border-tertiary); }
    .up-card-title { font-size: 17px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .up-table { width: 100%; border-collapse: collapse; font-size: 14.5px; }
    .up-table thead tr { border-bottom: 1px solid var(--color-border-tertiary); }
    .up-table th { padding: 12px 18px; font-size: 11px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--color-text-tertiary); text-align: left; white-space: nowrap; }
    .up-table tbody tr { border-bottom: 1px solid var(--color-border-tertiary); transition: background .14s; }
    .up-table tbody tr:last-child { border-bottom: none; }
    .up-table tbody tr:hover { background: rgba(0,0,0,.02); }
    .up-table td { padding: 12px 18px; vertical-align: middle; }
    .up-skel { height: 16px; border-radius: 4px; background: linear-gradient(90deg, var(--color-border-tertiary) 25%, rgba(0,0,0,.04) 50%, var(--color-border-tertiary) 75%); background-size: 200% 100%; animation: up-shimmer 1.4s infinite; }
    @keyframes up-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
    .up-empty { padding: 48px; text-align: center; color: var(--color-text-tertiary); font-size: 15px; }
    .up-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; animation: up-fade .18s ease; }
    .up-modal { background: var(--color-background-primary); border: 1px solid var(--color-border-tertiary); border-radius: 18px; padding: 32px; animation: up-rise .22s cubic-bezier(.22,.86,.44,1); }
    @keyframes up-fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes up-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
    .up-modal-field { margin-bottom: 16px; }
    .up-modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px; }
    .up-ibtn { width: 34px; height: 34px; border-radius: 8px; border: 1px solid transparent; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #94A3B8; transition: background .15s, border-color .15s, color .15s; }
    .up-ibtn-save:hover { background: #EEF2FF; border-color: #C7D2FE; color: #4338CA; }
    .up-ibtn-del:hover  { background: #FEF2F2; border-color: #FECACA; color: #DC2626; }
    .up-ibtn:disabled   { opacity: .35; cursor: not-allowed; }
    .up-btn-primary { display: inline-flex; align-items: center; gap: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 18px; border: none; border-radius: 9px; background: linear-gradient(135deg, #6366F1, #818CF8); color: #fff; cursor: pointer; box-shadow: 0 2px 10px rgba(99,102,241,.25); transition: opacity .15s; }
    .up-btn-primary:hover { opacity: .88; }
    .up-btn-cancel { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 20px; border: 1px solid #CBD5E1; border-radius: 9px; background: transparent; color: #64748B; cursor: pointer; }
    .up-btn-cancel:hover { background: rgba(0,0,0,.04); }
    .up-btn-submit { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 20px; border: none; border-radius: 9px; background: linear-gradient(135deg, #6366F1, #818CF8); color: #fff; cursor: pointer; }
    .up-btn-del { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 20px; border: none; border-radius: 9px; background: #DC2626; color: #fff; cursor: pointer; }
    .up-btn-del:hover { background: #B91C1C; }
  `
  document.head.appendChild(s)
}
 
/* shared MUI TextField sx — slightly larger text */
const fieldSx = { 
  '& .MuiInputBase-root': { fontSize: 14.5, borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border-tertiary, #E2E8F0)' },
}
 
/* ── icons ── */
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
)
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IconWarn = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
 
function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
      {[55, 35, 50, 25].map((w, i) => (
        <td key={i} style={{ padding: '16px 18px' }}>
          <div className="up-skel" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  )
}
 
export default function UsersPage() {
  const { token, role, username: currentUsername } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [editMap, setEditMap] = useState({})
  const [confirmUser, setConfirmUser] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'employee' })
 
  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await api.listUsers(token)
      setUsers(data || [])
      const nextEdit = {}
      for (const u of data || []) nextEdit[u.id] = { username: u.username, role: u.role, password: '' }
      setEditMap(nextEdit)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
 
  useEffect(() => { if (role !== 'admin') return; load() }, [role])
 
  if (role !== 'admin') {
    return (
      <Header title="Utilisateurs" subtitle="Admin uniquement">
        <Alert severity="warning">Accès refusé.</Alert>
      </Header>
    )
  }
 
  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
 
  const createUser = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.createUser(token, createForm)
      setCreateForm({ username: '', password: '', role: 'employee' })
      setShowCreate(false)
      flash('Utilisateur créé.')
      await load()
    } catch (err) { setError(err.message) }
  }
 
  const updateUser = async (id) => {
    setError('')
    try {
      const payload = { ...editMap[id] }
      if (!payload.password) delete payload.password
      await api.updateUser(token, id, payload)
      flash('Utilisateur mis à jour.')
      await load()
    } catch (err) { setError(err.message) }
  }
 
  const deleteUser = async (id) => {
    setError('')
    try {
      await api.deleteUser(token, id)
      flash('Utilisateur supprimé.')
      await load()
    } catch (err) { setError(err.message) }
  }
 
  const setEdit = (id, patch) =>
    setEditMap(p => ({ ...p, [id]: { ...p[id], ...patch } }))
 
  return (
    <Header title="Utilisateurs" subtitle="Gestion des comptes et des accès.">
      <div className="up-root">
        {error    && <Alert severity="error"    onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
 
        <div className="up-card">
          <div className="up-card-header">
            <span className="up-card-title">Liste des utilisateurs</span>
            <button className="up-btn-primary" onClick={() => setShowCreate(true)}>
              <IconPlus /> Créer un utilisateur
            </button>
          </div>
 
          <div style={{ overflowX: 'auto' }}>
            <table className="up-table">
              <thead>
                <tr>
                  <th>Identifiant</th>
                  <th>Rôle</th>
                  <th>Nouveau mot de passe</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  : users.length === 0
                  ? (
                    <tr><td colSpan={4}><div className="up-empty">Aucun utilisateur trouvé.</div></td></tr>
                  )
                  : users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <TextField
                          size="small" sx={{ ...fieldSx, maxWidth: 220 }}
                          value={editMap[u.id]?.username || ''}
                          onChange={e => setEdit(u.id, { username: e.target.value })}
                        />
                      </td>
                      <td>
                        <TextField
                          select size="small" sx={{ ...fieldSx, minWidth: 140 }}
                          value={editMap[u.id]?.role || 'employee'}
                          onChange={e => setEdit(u.id, { role: e.target.value })}
                        >
                          <MenuItem value="employee">Employé</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </TextField>
                      </td>
                      <td>
                        <TextField
                          size="small" type="password" sx={{ ...fieldSx, maxWidth: 240 }}
                          placeholder="Laisser vide pour conserver"
                          value={editMap[u.id]?.password || ''}
                          onChange={e => setEdit(u.id, { password: e.target.value })}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="up-ibtn up-ibtn-save"
                            title="Enregistrer"
                            onClick={() => updateUser(u.id)}
                          >
                            <IconSave />
                          </button>
                          <button
                            className="up-ibtn up-ibtn-del"
                            title={u.username === currentUsername ? 'Impossible de se supprimer soi-même' : 'Supprimer'}
                            disabled={u.username === currentUsername}
                            onClick={() => setConfirmUser(u)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
 
      {/* ── create modal ── */}
      {showCreate && (
        <div className="up-overlay" onClick={() => setShowCreate(false)}>
          <div className="up-modal" style={{ width: 'min(480px, 92vw)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 24 }}>
              Créer un utilisateur
            </div>
            <form onSubmit={createUser}>
              <div className="up-modal-field">
                <TextField
                  label="Identifiant" fullWidth size="small" sx={fieldSx}
                  placeholder="nom.prenom"
                  value={createForm.username}
                  onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                  required autoFocus
                />
              </div>
              <div className="up-modal-field">
                <TextField
                  label="Mot de passe" fullWidth size="small" type="password" sx={fieldSx}
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="up-modal-field">
                <TextField
                  select label="Rôle" fullWidth size="small" sx={fieldSx}
                  value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                  SelectProps={{
                    MenuProps: {
                      disablePortal: false,
                      sx: { zIndex: 9999 },
                    },
                  }}
                >
                  <MenuItem value="employee">Employé</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </TextField>
              </div>
              <div className="up-modal-actions">
                <button type="button" className="up-btn-cancel" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button type="submit" className="up-btn-submit">
                  Créer l'utilisateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* ── delete confirm modal ── */}
      {confirmUser && (
        <div className="up-overlay" onClick={() => setConfirmUser(null)}>
          <div className="up-modal" style={{ width: 'min(440px, 92vw)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: '#FEF2F2', border: '1px solid #FECACA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconWarn />
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                  Supprimer l'utilisateur
                </div>
                <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Cette action est irréversible. L'utilisateur{' '}
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 13,
                    background: 'rgba(0,0,0,.05)', border: '1px solid var(--color-border-tertiary)',
                    borderRadius: 6, padding: '3px 10px', color: 'var(--color-text-primary)',
                  }}>
                    {confirmUser.username}
                  </span>{' '}
                  et tout son historique seront définitivement supprimés.
                </p>
              </div>
            </div>
            <div className="up-modal-actions">
              <button className="up-btn-cancel" onClick={() => setConfirmUser(null)}>Annuler</button>
              <button className="up-btn-del" onClick={async () => {
                const id = confirmUser.id
                setConfirmUser(null)
                await deleteUser(id)
              }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </Header>
  )
}