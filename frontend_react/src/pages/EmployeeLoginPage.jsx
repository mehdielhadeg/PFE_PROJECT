import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { useAuth } from '../context/AuthContext'

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
      setError(err.message || 'Login failed')
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 470, background: 'rgba(13, 20, 38, 0.9)' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Employee Sign In</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box component="form" onSubmit={submit}>
              <Stack spacing={1.5}>
                <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Button type="submit" variant="contained">Continue</Button>
              </Stack>
            </Box>

            <Typography variant="body2">
              Need elevated access? <Link to="/login/admin">Login as admin</Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
