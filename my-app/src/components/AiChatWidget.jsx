import { useState, useEffect, useRef } from 'react'
import { sendAiAssistantMessage, getAuthToken, isManagerToken, isAdminToken, uploadTempFile } from '../api'

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [coverFile, setCoverFile] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const fileInputCoverRef = useRef(null)
  const fileInputPdfRef = useRef(null)
  const fileInputAudioRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const token = getAuthToken()
    const isManager = isManagerToken(token)
    const isAdminUser = isAdminToken(token)
    setIsAdmin(isAdminUser)
    
    let welcomeText = 'Привет! Я ваш ИИ-ассистент. Я могу помочь вам найти книгу на сайте или порекомендовать интересное чтение. Что вы ищете?'
    if (isAdminUser) {
      welcomeText = 'Привет! Я ваш ИИ-ассистент администратора. Я могу помочь вам добавить новых авторов, категории, подкатегории или книги в каталог, а также управлять заказами доставки. Для добавления книг вы можете прикреплять файлы (обложка, PDF, аудио) прямо в чат!'
    } else if (isManager) {
      welcomeText = 'Привет! Я ваш ИИ-ассистент менеджера. Я могу помочь вам найти книгу, а также быстро изменить статусы заказов доставки (например, перевести заказ в статус "Отправлен" или "Доставлен"). Что требуется сделать?'
    }
    
    setMessages([
      {
        sender: 'bot',
        text: welcomeText,
      }
    ])
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadTempFile(file)
      const fileData = { id: res.fileId, name: file.name }
      if (type === 'cover') setCoverFile(fileData)
      if (type === 'pdf') setPdfFile(fileData)
      if (type === 'audio') setAudioFile(fileData)
    } catch (err) {
      alert('Ошибка при загрузке файла: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if ((!text && !coverFile && !pdfFile && !audioFile) || loading || uploading) return

    let textToSend = text
    const attachments = []
    if (coverFile) attachments.push(`Cover = ${coverFile.id}`)
    if (pdfFile) attachments.push(`PDF = ${pdfFile.id}`)
    if (audioFile) attachments.push(`Audio = ${audioFile.id}`)

    if (attachments.length > 0) {
      textToSend += (textToSend ? ' ' : '') + `[Uploaded Files: ${attachments.join(', ')}]`
    }

    setInput('')
    setCoverFile(null)
    setPdfFile(null)
    setAudioFile(null)

    setMessages((prev) => [...prev, { sender: 'user', text: text || 'Файлы прикреплены' }])
    setLoading(true)

    try {
      const response = await sendAiAssistantMessage(textToSend)
      setMessages((prev) => [...prev, { sender: 'bot', text: response.response }])
      if (response.hasChanges) {
        window.dispatchEvent(new CustomEvent('catalog-updated'))
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Извините, произошла ошибка подключения к ИИ-ассистенту. Пожалуйста, попробуйте позже.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const parseMarkdownLinks = (text) => {
    if (!text) return ''
    const regex = /\[(.*?)\]\((.*?)\)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, linkText, linkUrl] = match
      const textBefore = text.slice(lastIndex, match.index)
      if (textBefore) {
        parts.push(textBefore)
      }
      parts.push(
        <a
          key={match.index}
          href={linkUrl}
          style={{
            color: 'var(--color-accent)',
            textDecoration: 'underline',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {linkText}
        </a>
      )
      lastIndex = regex.lastIndex
    }

    const textAfter = text.slice(lastIndex)
    if (textAfter) {
      parts.push(textAfter)
    }

    return parts.length > 0 ? parts : text
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-accent, #bfa054)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            transition: 'transform 0.2s ease, background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          aria-label="Открыть чат с ассистентом"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4M8 16h.01M16 16h.01" />
          </svg>
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div
          style={{
            width: '360px',
            height: '500px',
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(17, 24, 39, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.25s ease-out',
            color: 'var(--color-text)',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-secondary)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4M8 16h.01M16 16h.01" />
              </svg>
              <div>
                <strong style={{ display: 'block', fontSize: '14px' }}>Книжный Ассистент</strong>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Онлайн-консультант</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text)',
                fontSize: '20px',
                cursor: 'pointer',
                opacity: 0.7,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
            >
              ×
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, i) => {
              const isBot = msg.sender === 'bot'
              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isBot ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: isBot ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    backgroundColor: isBot ? 'var(--color-secondary)' : 'var(--color-accent)',
                    color: isBot ? 'var(--color-text)' : 'var(--color-on-accent)',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {isBot ? parseMarkdownLinks(msg.text) : msg.text}
                </div>
              )
            })}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  backgroundColor: 'var(--color-secondary)',
                  color: 'var(--color-text-muted)',
                  fontSize: '13px',
                  fontStyle: 'italic',
                }}
              >
                Печатает...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>

          {/* File Chips */}
          {(coverFile || pdfFile || audioFile || uploading) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '8px 12px 4px 12px',
              backgroundColor: 'var(--color-white)',
            }}>
              {uploading && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.5s linear infinite' }}>
                    <line x1="12" y1="2" x2="12" y2="6"/>
                    <line x1="12" y1="18" x2="12" y2="22"/>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                    <line x1="2" y1="12" x2="6" y2="12"/>
                    <line x1="18" y1="12" x2="22" y2="12"/>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                  Загрузка файла...
                </div>
              )}
              {coverFile && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(191, 160, 84, 0.1)',
                  border: '1px solid rgba(191, 160, 84, 0.3)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--color-text)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Обложка: {coverFile.name.length > 15 ? coverFile.name.substring(0, 12) + '...' : coverFile.name}
                  <button type="button" onClick={() => setCoverFile(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--color-text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              )}
              {pdfFile && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(191, 160, 84, 0.1)',
                  border: '1px solid rgba(191, 160, 84, 0.3)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--color-text)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  PDF: {pdfFile.name.length > 15 ? pdfFile.name.substring(0, 12) + '...' : pdfFile.name}
                  <button type="button" onClick={() => setPdfFile(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--color-text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              )}
              {audioFile && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(191, 160, 84, 0.1)',
                  border: '1px solid rgba(191, 160, 84, 0.3)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--color-text)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  Аудио: {audioFile.name.length > 15 ? audioFile.name.substring(0, 12) + '...' : audioFile.name}
                  <button type="button" onClick={() => setAudioFile(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--color-text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Admin File Upload Panel */}
          {isAdmin && (
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--color-white)',
              borderTop: '1px solid var(--color-border)',
            }}>
              <input type="file" ref={fileInputCoverRef} onChange={(e) => handleFileUpload(e, 'cover')} accept="image/*" style={{ display: 'none' }} />
              <input type="file" ref={fileInputPdfRef} onChange={(e) => handleFileUpload(e, 'pdf')} accept=".pdf" style={{ display: 'none' }} />
              <input type="file" ref={fileInputAudioRef} onChange={(e) => handleFileUpload(e, 'audio')} accept="audio/*" style={{ display: 'none' }} />
              
              <button
                type="button"
                onClick={() => fileInputCoverRef.current?.click()}
                disabled={uploading || !!coverFile}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  backgroundColor: 'var(--color-secondary)',
                  color: 'var(--color-text)',
                  fontSize: '11px',
                  cursor: uploading || !!coverFile ? 'default' : 'pointer',
                  opacity: uploading || !!coverFile ? 0.6 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!uploading && !coverFile) e.currentTarget.style.backgroundColor = 'rgba(191, 160, 84, 0.1)'; }}
                onMouseLeave={(e) => { if (!uploading && !coverFile) e.currentTarget.style.backgroundColor = 'var(--color-secondary)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Обложка
              </button>
              
              <button
                type="button"
                onClick={() => fileInputPdfRef.current?.click()}
                disabled={uploading || !!pdfFile}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  backgroundColor: 'var(--color-secondary)',
                  color: 'var(--color-text)',
                  fontSize: '11px',
                  cursor: uploading || !!pdfFile ? 'default' : 'pointer',
                  opacity: uploading || !!pdfFile ? 0.6 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!uploading && !pdfFile) e.currentTarget.style.backgroundColor = 'rgba(191, 160, 84, 0.1)'; }}
                onMouseLeave={(e) => { if (!uploading && !pdfFile) e.currentTarget.style.backgroundColor = 'var(--color-secondary)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
              
              <button
                type="button"
                onClick={() => fileInputAudioRef.current?.click()}
                disabled={uploading || !!audioFile}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  backgroundColor: 'var(--color-secondary)',
                  color: 'var(--color-text)',
                  fontSize: '11px',
                  cursor: uploading || !!audioFile ? 'default' : 'pointer',
                  opacity: uploading || !!audioFile ? 0.6 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!uploading && !audioFile) e.currentTarget.style.backgroundColor = 'rgba(191, 160, 84, 0.1)'; }}
                onMouseLeave={(e) => { if (!uploading && !audioFile) e.currentTarget.style.backgroundColor = 'var(--color-secondary)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                Аудио
              </button>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '12px',
              backgroundColor: 'var(--color-white)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAdmin ? "Напишите сообщение или команду..." : "Напишите сообщение..."}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-secondary)',
                color: 'var(--color-text)',
                fontSize: '13px',
                outline: 'none',
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !coverFile && !pdfFile && !audioFile) || loading || uploading}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                backgroundColor: (input.trim() || coverFile || pdfFile || audioFile) && !loading && !uploading ? 'var(--color-accent)' : 'var(--color-field-disabled)',
                color: (input.trim() || coverFile || pdfFile || audioFile) && !loading && !uploading ? 'var(--color-on-accent)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: (input.trim() || coverFile || pdfFile || audioFile) && !loading && !uploading ? 'pointer' : 'default',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'background-color 0.2s ease',
              }}
            >
              Отправить
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
