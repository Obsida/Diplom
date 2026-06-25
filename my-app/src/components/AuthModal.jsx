import { useState } from 'react'
import { getYandexOAuthStartUrl, login, register, saveAuthToken, requestPasswordReset, resetPassword } from '../api'
import { useModalBackdropClose } from '../utils/useModalBackdropClose'
import yandexLogo from '../img/yandex.svg'

const initialRegister = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  middleName: '',
  phone: '',
}

const AuthModal = ({ onClose, onAuthSuccess, promptText = '' }) => {
  const [mode, setMode] = useState('login')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState(initialRegister)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const backdropClose = useModalBackdropClose(onClose)

  const submitLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(loginForm)
      if (!data?.token) throw new Error('Токен не получен.')
      saveAuthToken(data.token)
      onAuthSuccess(data.token)
      onClose()
    } catch (err) {
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  const submitRegister = async (e) => {
    e.preventDefault()
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { confirmPassword, ...payload } = registerForm
      void confirmPassword
      const data = await register(payload)
      if (data?.token) {
        saveAuthToken(data.token)
        onAuthSuccess(data.token)
        onClose()
        return
      }
      setMode('login')
      setError('Регистрация выполнена. Теперь выполните вход.')
    } catch (err) {
      setError(err.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const submitForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      await requestPasswordReset(forgotEmail)
      setMode('reset-password')
      setSuccessMessage(`Код подтверждения отправлен на ${forgotEmail}`)
    } catch (err) {
      setError(err.message || 'Ошибка запроса кода')
    } finally {
      setLoading(false)
    }
  }

  const submitResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }
    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов.')
      return
    }
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      await resetPassword(forgotEmail, resetCode.trim(), newPassword)
      setMode('login')
      setSuccessMessage('Пароль успешно изменен. Теперь вы можете войти.')
      setForgotEmail('')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Ошибка сброса пароля')
    } finally {
      setLoading(false)
    }
  }

  const startYandexOAuth = () => {
    const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = getYandexOAuthStartUrl(returnUrl)
  }

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '')

    const cleaned = digits.startsWith('7') || digits.startsWith('8')
      ? digits.slice(1)
      : digits

    const limited = cleaned.slice(0, 10)

    let formatted = '+7'
    if (limited.length > 0) formatted += ' (' + limited.slice(0, 3)
    if (limited.length >= 3) formatted += ') ' + limited.slice(3, 6)
    if (limited.length >= 6) formatted += '-' + limited.slice(6, 8)
    if (limited.length >= 8) formatted += '-' + limited.slice(8, 10)

    setRegisterForm(v => ({ ...v, phone: formatted }))
  }

  const handlePhoneKeyDown = (e) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End']
    if (allowed.includes(e.key)) return
    if (!/^\d$/.test(e.key)) e.preventDefault()
  }

  return (
    <div className="auth-overlay" role="presentation" {...backdropClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="auth-modal__header">
          <button type="button" className="auth-modal__close auth-modal__close--header" onClick={onClose}>x</button>
          <h3 className="auth-modal__title">
            {mode === 'forgot-password' ? 'Восстановление пароля' : mode === 'reset-password' ? 'Сброс пароля' : 'Добро пожаловать'}
          </h3>
          <p className="auth-modal__subtitle">
            {mode === 'forgot-password' ? 'Введите email для получения кода подтверждения.' : mode === 'reset-password' ? 'Введите полученный код и новый пароль.' : 'Войдите в аккаунт, чтобы читать книги и управлять библиотекой.'}
          </p>
          {promptText && (mode === 'login' || mode === 'register') ? <p className="auth-modal__prompt">{promptText}</p> : null}
        </div>

        {successMessage && <div className="auth-modal__success" style={{ color: 'var(--color-accent)', background: 'var(--color-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{successMessage}</div>}

        {error && <div className="auth-modal__error">{error}</div>}

        {mode === 'forgot-password' ? (
          <form className="auth-modal__form" onSubmit={submitForgotPassword}>
            <input
              className="auth-modal__input"
              placeholder="Эл. почта"
              type="email"
              required
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
            />
            <button className="btn btn--dark auth-modal__submit" disabled={loading} type="submit">
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
            <button
              type="button"
              className="auth-modal__switch"
              onClick={() => {
                setError('')
                setSuccessMessage('')
                setMode('login')
              }}
            >
              Вернуться к входу
            </button>
          </form>
        ) : mode === 'reset-password' ? (
          <form className="auth-modal__form" onSubmit={submitResetPassword}>
            <input
              className="auth-modal__input"
              placeholder="Эл. почта"
              type="email"
              required
              disabled
              value={forgotEmail}
            />
            <input
              className="auth-modal__input"
              placeholder="Код подтверждения"
              type="text"
              required
              maxLength={6}
              value={resetCode}
              onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
            />
            <input
              className="auth-modal__input"
              placeholder="Новый пароль"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <input
              className="auth-modal__input"
              placeholder="Подтвердить новый пароль"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <button className="btn btn--dark auth-modal__submit" disabled={loading} type="submit">
              {loading ? 'Сохранение...' : 'Сбросить пароль'}
            </button>
            <button
              type="button"
              className="auth-modal__switch"
              onClick={() => {
                setError('')
                setSuccessMessage('')
                setMode('forgot-password')
              }}
            >
              Отправить код повторно
            </button>
          </form>
        ) : mode === 'login' ? (
          <form className="auth-modal__form" onSubmit={submitLogin}>
            <input
              className="auth-modal__input"
              placeholder="Эл. почта"
              type="email"
              required
              value={loginForm.email}
              onChange={e => setLoginForm(v => ({ ...v, email: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Пароль"
              type="password"
              required
              value={loginForm.password}
              onChange={e => setLoginForm(v => ({ ...v, password: e.target.value }))}
            />
            <button
              type="button"
              className="auth-modal__forgot-link"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'right',
                width: '100%',
                padding: '0',
                marginTop: '-8px',
                marginBottom: '10px',
                fontFamily: 'var(--font-sans)',
                fontWeight: '600',
                textDecoration: 'underline'
              }}
              onClick={() => {
                setError('')
                setSuccessMessage('')
                setForgotEmail(loginForm.email)
                setMode('forgot-password')
              }}
            >
              Забыли пароль?
            </button>
            <button className="btn btn--dark auth-modal__submit" disabled={loading} type="submit">
              {loading ? 'Входим...' : 'Войти'}
            </button>
            <button
              type="button"
              className="auth-modal__switch"
              onClick={() => {
                setError('')
                setSuccessMessage('')
                setMode('register')
              }}
            >
              Зарегистрироваться
            </button>
            <button
              type="button"
              className="auth-modal__oauth"
              onClick={startYandexOAuth}
            >
              <img src={yandexLogo} alt="" />
              Войти через Яндекс
            </button>
          </form>
        ) : (
          <form className="auth-modal__form" onSubmit={submitRegister}>
            <input
              className="auth-modal__input"
              placeholder="Эл. почта"
              type="email"
              required
              value={registerForm.email}
              onChange={e => setRegisterForm(v => ({ ...v, email: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Пароль"
              type="password"
              required
              minLength={6}
              value={registerForm.password}
              onChange={e => setRegisterForm(v => ({ ...v, password: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Подтвердить пароль"
              type="password"
              required
              minLength={6}
              value={registerForm.confirmPassword}
              onChange={e => setRegisterForm(v => ({ ...v, confirmPassword: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Имя"
              value={registerForm.firstName}
              onChange={e => setRegisterForm(v => ({ ...v, firstName: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Фамилия"
              value={registerForm.lastName}
              onChange={e => setRegisterForm(v => ({ ...v, lastName: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="Отчество"
              value={registerForm.middleName}
              onChange={e => setRegisterForm(v => ({ ...v, middleName: e.target.value }))}
            />
            <input
              className="auth-modal__input"
              placeholder="+7 (___) ___-__-__"
              value={registerForm.phone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
            />
            <button className="btn btn--dark auth-modal__submit" disabled={loading} type="submit">
              {loading ? 'Регистрируем...' : 'Зарегистрироваться'}
            </button>
            <button
              type="button"
              className="auth-modal__switch"
              onClick={() => {
                setError('')
                setMode('login')
              }}
            >
              Войти
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AuthModal
