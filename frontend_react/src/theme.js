import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5e87ff' },
    secondary: { main: '#39d0c7' },
    background: {
      default: '#0b1020',
      paper: '#121a30',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, Segoe UI, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(154, 174, 255, 0.2)',
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
  },
})

export default theme
