import { Link, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'

import { useAuth } from '../context/AuthContext'

export default function Header({ title, subtitle, sidebarExtra, headerActions, children, layout }) {
  const { role, username, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    ...(role === 'admin' ? [{ to: '/dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> }] : []),
    { to: '/chat', label: 'Chat', icon: <ChatOutlinedIcon fontSize="small" /> },
    { to: '/documents', label: 'Documents', icon: <DescriptionOutlinedIcon fontSize="small" /> },
    ...(role === 'admin' ? [{ to: '/users', label: 'Users', icon: <GroupOutlinedIcon fontSize="small" /> }] : []),
  ]

  const rootClass = layout === 'chat' ? 'cg-root cg-root-chat' : 'cg-root'
  const mainClass = layout === 'chat' ? 'cg-main cg-main-chat' : 'cg-main'

  return (
    <Box className={rootClass}>
      <Box component="aside" className="cg-sidebar">
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>RAG Assistant</Typography>
        <Typography variant="body2" sx={{ opacity: 0.82 }}>{username}</Typography>
        <Typography variant="body2" sx={{ opacity: 0.82, mb: 2 }}>Role: {role}</Typography>

        <Box className="cg-sidebar-nav">
          <Stack spacing={1}>
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <Button
                  key={item.to}
                  component={Link}
                  to={item.to}
                  variant={active ? 'contained' : 'outlined'}
                  color={active ? 'primary' : 'inherit'}
                  startIcon={item.icon}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Stack>

          {sidebarExtra ? (
            <>
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.14)' }} />
              <Box>{sidebarExtra}</Box>
            </>
          ) : null}
        </Box>

        <Box className="cg-sidebar-footer">
          <Button fullWidth variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>
            Logout
          </Button>
        </Box>
      </Box>

      <Box component="main" className={mainClass}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
          {headerActions || null}
        </Box>
        {subtitle ? <Typography variant="body1" sx={{ opacity: 0.78, mb: 2 }}>{subtitle}</Typography> : null}
        <Box className="cg-page-body">
          {children}
        </Box>
      </Box>
    </Box>
  )
}
