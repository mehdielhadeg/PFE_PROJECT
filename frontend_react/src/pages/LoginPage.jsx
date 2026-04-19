import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { loginAdmin, loginEmployee } = useAuth()
  const [adminForm, setAdminForm] = useState({ username: '', password: '' })
  const [employeeForm, setEmployeeForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submitAdmin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await loginAdmin(adminForm.username, adminForm.password)
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    }
  }

  const submitEmployee = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await loginEmployee(employeeForm.username, employeeForm.password)
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="layout">
      <h1>Login</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid-2">
        <form className="card" onSubmit={submitAdmin}>
          <h3>Admin</h3>
          <input placeholder="Username" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} />
          <div style={{ height: 8 }} />
          <input type="password" placeholder="Password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
          <div style={{ height: 12 }} />
          <button className="primary" type="submit">Login as Admin</button>
        </form>

        <form className="card" onSubmit={submitEmployee}>
          <h3>Employee</h3>
          <input placeholder="Username" value={employeeForm.username} onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })} />
          <div style={{ height: 8 }} />
          <input type="password" placeholder="Password" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} />
          <div style={{ height: 12 }} />
          <button className="primary" type="submit">Login as Employee</button>
        </form>
      </div>
    </div>
  )
}
