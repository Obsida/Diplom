import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './config/theme.css'
import './index.css'
import App from './App.jsx'
import ReadPdfPage from './pages/ReadPdfPage.jsx'
import BookPage from './pages/BookPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ManagerPage from './pages/ManagerPage.jsx'
import GlobalAudioPlayer from './components/GlobalAudioPlayer.jsx'
import AiChatWidget from './components/AiChatWidget.jsx'
import { getAuthToken, isAdminToken, isManagerToken } from './api'

function resolvePage() {
  const path = window.location.pathname.toLowerCase()
  const token = getAuthToken()
  if (path !== '/admin' && isAdminToken(token)) {
    window.location.replace('/admin')
    return null
  }
  if (path !== '/manager' && isManagerToken(token)) {
    window.location.replace('/manager')
    return null
  }
  if (path === '/readdpdf' || path === '/readdpdf&') {
    return <ReadPdfPage />
  }
  if (path.startsWith('/book/')) {
    return <BookPage />
  }
  if (path === '/admin') return <AdminPage />
  if (path === '/manager') return <ManagerPage />
  if (path === '/library') return <App initialView="library" />
  if (path === '/bookmarks') return <App initialView="bookmarks" />
  if (path === '/cart') return <App initialView="cart" />
  if (path === '/purchases') return <App initialView="purchases" />
  if (path === '/purchased-books') return <App initialView="purchased_books" />
  if (path === '/profile') return <App initialView="profile" />
  return <App initialView="home" />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      {resolvePage()}
      <GlobalAudioPlayer />
      <AiChatWidget />
    </>
  </StrictMode>,
)
