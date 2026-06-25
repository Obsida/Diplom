import { useEffect, useMemo, useState } from 'react'
import {
  cancelMySubscription,
  fetchMyProfile,
  fetchMySubscriptions,
  updateMyProfile,
  fetchFamilyMembers,
  addFamilyMember,
  removeFamilyMember,
  requestPasswordReset,
  resetPassword
} from '../api'
import SubscriptionModal from './SubscriptionModal'

const PROFILE_TABS = [
  { id: 'home', label: 'Главная' },
  { id: 'subscription', label: 'Управление подпиской' },
  { id: 'security', label: 'Безопасность' },
]

const emptyProfileForm = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
}

function pickProfileValue(profile, ...keys) {
  for (const key of keys) {
    const value = profile?.[key]
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
}

function normalizeProfile(profile) {
  return {
    firstName: pickProfileValue(profile, 'firstName', 'FirstName'),
    lastName: pickProfileValue(profile, 'lastName', 'LastName'),
    middleName: pickProfileValue(profile, 'middleName', 'MiddleName'),
    email: pickProfileValue(profile, 'email', 'Email'),
    phone: pickProfileValue(profile, 'phone', 'Phone'),
    subscriptionOwnerId: profile?.subscriptionOwnerId ?? profile?.SubscriptionOwnerId ?? null,
    subscriptionOwnerEmail: profile?.subscriptionOwnerEmail ?? profile?.SubscriptionOwnerEmail ?? null,
  }
}

function validateProfile(form) {
  const firstName = form.firstName.trim()
  const lastName = form.lastName.trim()
  const middleName = form.middleName.trim()
  const phone = form.phone.trim()

  if (!firstName) return 'Укажите имя.'
  if (!lastName) return 'Укажите фамилию.'
  if (firstName.length > 80 || lastName.length > 80 || middleName.length > 80) {
    return 'Имя, фамилия и отчество должны быть короче 80 символов.'
  }
  if (phone && !/^[+\d][\d\s\-()]{5,24}$/.test(phone)) {
    return 'Укажите корректный телефон.'
  }

  return ''
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('ru-RU')
}

function formatPrice(value) {
  const amount = Number(value)
  if (Number.isNaN(amount)) return '—'
  return `${amount.toLocaleString('ru-RU')} ₽`
}

const SUBSCRIPTION_STATUS_LABELS = {
  active: 'Активна',
  cancelled: 'Отменена',
  completed: 'Завершена',
  expired: 'Истекла',
  failed: 'Ошибка оплаты',
  pending: 'Ожидает оплаты',
  success: 'Оплачена',
}

const PAYMENT_METHOD_LABELS = {
  card: 'Банковская карта',
  cash: 'Наличные',
  sbp: 'СБП',
  yoomoney: 'ЮMoney',
}

function formatSubscriptionStatus(status) {
  const key = String(status || '').trim().toLowerCase()
  if (!key) return '—'
  return SUBSCRIPTION_STATUS_LABELS[key] || status
}

function formatPaymentMethod(method) {
  const key = String(method || '').trim().toLowerCase()
  if (!key) return '—'
  return PAYMENT_METHOD_LABELS[key] || method
}

function getActiveSubscription(subscriptions) {
  const now = new Date()
  return (Array.isArray(subscriptions) ? subscriptions : []).find((item) => {
    if (String(item?.status || '').toLowerCase() !== 'success') return false
    if (!item?.endDate) return false

    const endDate = new Date(`${item.endDate}T23:59:59`)
    return !Number.isNaN(endDate.getTime()) && endDate >= now
  }) ?? null
}

export default function ProfileContent({ isAuthorized, onAuthRequired, onBack, onSaved, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(emptyProfileForm)
  const [activeTab, setActiveTab] = useState('home')
  const [subscriptions, setSubscriptions] = useState([])
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [cancelingSubscription, setCancelingSubscription] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [subscriptionError, setSubscriptionError] = useState('')
  const [success, setSuccess] = useState('')

  // Безопасность (сброс пароля)
  const [securityPhase, setSecurityPhase] = useState('request')
  const [securityCode, setSecurityCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securitySuccess, setSecuritySuccess] = useState('')

  const handleRequestSecurityCode = async (e) => {
    e.preventDefault()
    setSecurityLoading(true)
    setSecurityError('')
    setSecuritySuccess('')
    try {
      await requestPasswordReset(form.email)
      setSecurityPhase('reset')
      setSecuritySuccess(`Код подтверждения отправлен на ${form.email}`)
    } catch (err) {
      setSecurityError(err.message || 'Не удалось отправить код подтверждения.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setSecurityError('Пароли не совпадают.')
      return
    }
    if (newPassword.length < 6) {
      setSecurityError('Пароль должен быть не менее 6 символов.')
      return
    }
    setSecurityLoading(true)
    setSecurityError('')
    setSecuritySuccess('')
    try {
      await resetPassword(form.email, securityCode.trim(), newPassword)
      setSecuritySuccess('Пароль успешно изменен.')
      setSecurityPhase('request')
      setSecurityCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setSecurityError(err.message || 'Не удалось изменить пароль.')
    } finally {
      setSecurityLoading(false)
    }
  }

  const activeSubscription = useMemo(() => getActiveSubscription(subscriptions), [subscriptions])

  // Семья
  const [familyMembers, setFamilyMembers] = useState([])
  const [familyLoading, setFamilyLoading] = useState(false)
  const [familyError, setFamilyError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const loadFamily = async () => {
    setFamilyLoading(true)
    setFamilyError('')
    try {
      const data = await fetchFamilyMembers()
      setFamilyMembers(Array.isArray(data) ? data : [])
    } catch (err) {
      setFamilyError(err?.message || 'Не удалось загрузить участников подписки.')
    } finally {
      setFamilyLoading(false)
    }
  }

  const handleAddFamilyMember = async (event) => {
    event.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return

    setInviteSubmitting(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      await addFamilyMember(email)
      setInviteEmail('')
      setInviteSuccess('Пользователь успешно добавлен в семейную подписку!')
      await loadFamily()
    } catch (err) {
      setInviteError(err?.message || 'Не удалось добавить участника.')
    } finally {
      setInviteSubmitting(false)
    }
  }

  const handleRemoveFamilyMember = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого участника из семейной подписки?')) return

    try {
      await removeFamilyMember(userId)
      setSuccess('Участник успешно удален.')
      await loadFamily()
    } catch (err) {
      setSuccess('')
      alert(err?.message || 'Не удалось удалить участника.')
    }
  }

  useEffect(() => {
    if (activeTab === 'subscription' && activeSubscription && activeSubscription.maxUsers > 1) {
      loadFamily()
    }
  }, [activeTab, activeSubscription])

  const loadSubscriptions = async () => {
    if (!isAuthorized) {
      setSubscriptions([])
      return
    }

    setSubscriptionsLoading(true)
    setSubscriptionError('')
    try {
      const data = await fetchMySubscriptions()
      setSubscriptions(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setSubscriptions([])
      setSubscriptionError(loadError?.message || 'Не удалось загрузить подписки.')
    } finally {
      setSubscriptionsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthorized) {
      setProfile(null)
      setForm(emptyProfileForm)
      setSubscriptions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setSuccess('')

    fetchMyProfile()
      .then((data) => {
        if (cancelled) return
        const normalized = normalizeProfile(data)
        setProfile(data)
        setForm(normalized)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError?.message || 'Не удалось загрузить профиль.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthorized])

  useEffect(() => {
    if (!isAuthorized) return
    loadSubscriptions()
  }, [isAuthorized])

  const fullName = useMemo(() => {
    const parts = [form.firstName, form.middleName, form.lastName].map((part) => part.trim()).filter(Boolean)
    return parts.join(' ') || 'Профиль'
  }, [form.firstName, form.lastName, form.middleName])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isAuthorized) {
      onAuthRequired?.()
      return
    }

    const validationError = validateProfile(form)
    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const saved = await updateMyProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
        phone: form.phone,
      })
      const normalized = normalizeProfile(saved || form)
      const nextForm = {
        ...form,
        ...normalized,
        email: normalized.email || form.email,
      }
      setProfile(saved || profile)
      setForm(nextForm)
      setSuccess('Профиль сохранён.')
      onSaved?.(nextForm)
    } catch (saveError) {
      setError(saveError?.message || 'Не удалось сохранить профиль.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!activeSubscription || cancelingSubscription) return

    setCancelingSubscription(true)
    setSubscriptionError('')
    setSuccess('')

    try {
      await cancelMySubscription()
      await loadSubscriptions()
      setSuccess('Подписка отменена.')
    } catch (cancelError) {
      setSubscriptionError(cancelError?.message || 'Не удалось отменить подписку.')
    } finally {
      setCancelingSubscription(false)
    }
  }

  const renderHomeTab = () => (
    <div className="profile-page__grid">
      <aside className="profile-summary">
        <div className="profile-summary__avatar" aria-hidden="true">
          {(form.firstName.trim()[0] || form.email.trim()[0] || 'П').toUpperCase()}
        </div>
        <strong>{fullName}</strong>
        <span>{form.email || 'Почта не указана'}</span>
        <span>{form.phone || 'Телефон не указан'}</span>
      </aside>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-form__row">
          <label className="profile-field">
            <span>Имя</span>
            <input
              className="catalog-field__input"
              value={form.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
              maxLength={80}
              required
            />
          </label>
          <label className="profile-field">
            <span>Фамилия</span>
            <input
              className="catalog-field__input"
              value={form.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
              maxLength={80}
              required
            />
          </label>
        </div>

        <div className="profile-form__row">
          <label className="profile-field">
            <span>Отчество</span>
            <input
              className="catalog-field__input"
              value={form.middleName}
              onChange={(event) => updateField('middleName', event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="profile-field">
            <span>Телефон</span>
            <input
              className="catalog-field__input"
              type="tel"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              maxLength={25}
              placeholder="+7 900 000-00-00"
            />
          </label>
        </div>

        <label className="profile-field">
          <span>Эл. почта</span>
          <input className="catalog-field__input" value={form.email} disabled readOnly />
        </label>

        <div className="profile-form__actions">
          <button type="submit" className="btn btn--dark" disabled={loading || saving}>
            {saving ? 'Сохраняем...' : 'Сохранить профиль'}
          </button>
        </div>
      </form>
    </div>
  )

  const renderSubscriptionTab = () => (
    <section className="profile-subscription">
      <div className="profile-card profile-subscription__status">
        <div className="profile-card__header">
          <div>
            <h2>Подписка</h2>
            <p>Управляйте доступом к чтению, аудио и отзывам.</p>
          </div>
          <button type="button" className="btn btn--light" onClick={loadSubscriptions} disabled={subscriptionsLoading}>
            {subscriptionsLoading ? '...' : 'Обновить'}
          </button>
        </div>

        {subscriptionError ? <div className="catalog-error">{subscriptionError}</div> : null}

        {subscriptionsLoading ? (
          <div className="catalog-loading">Загрузка подписки...</div>
        ) : activeSubscription ? (
          <div className="profile-subscription__active">
            <span className="moderation-badge moderation-badge--violation">Активна</span>
            <strong>{activeSubscription.planName}</strong>
            <p>Действует до {formatDate(activeSubscription.endDate)}</p>
            <p>Оплачено: {formatPrice(activeSubscription.paidAmount)} · {formatPaymentMethod(activeSubscription.paymentMethod)}</p>
          </div>
        ) : (
          <div className="profile-subscription__active">
            <span className="moderation-badge moderation-badge--hidden">Нет активной подписки</span>
            <strong>Оформите подписку</strong>
            <p>После покупки здесь появится срок действия и история операций.</p>
          </div>
        )}

        <div className="profile-subscription__actions">
          <button type="button" className="btn btn--dark" onClick={() => setSubscriptionOpen(true)}>
            {activeSubscription ? 'Продлить или сменить тариф' : 'Оформить подписку'}
          </button>
          {activeSubscription && !profile?.subscriptionOwnerId ? (
            <button
              type="button"
              className="btn btn--light"
              onClick={handleCancelSubscription}
              disabled={cancelingSubscription}
            >
              {cancelingSubscription ? 'Отменяем...' : 'Отменить подписку'}
            </button>
          ) : null}
        </div>
      </div>

      {profile?.subscriptionOwnerId ? (
        <div className="profile-card">
          <div className="profile-card__header">
            <div>
              <h2>Семейная подписка</h2>
              <p>Вы пользуетесь семейной подпиской.</p>
            </div>
          </div>
          <div className="profile-subscription__active" style={{ marginTop: '1rem' }}>
            <span className="moderation-badge moderation-badge--violation">Участник</span>
            <p style={{ marginTop: '0.5rem' }}>Семейный доступ предоставлен владельцем: <strong>{profile.subscriptionOwnerEmail}</strong></p>
            <p>Вам доступны все преимущества активной подписки.</p>
          </div>
        </div>
      ) : activeSubscription && activeSubscription.maxUsers > 1 ? (
        <div className="profile-card">
          <div className="profile-card__header">
            <div>
              <h2>Семейная подписка</h2>
              <p>Разделите доступ к книгам со своими близкими (до {activeSubscription.maxUsers} пользователей).</p>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div className="profile-subscription__active" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px' }}>
              <strong>Занято мест: {familyMembers.length + 1} из {activeSubscription.maxUsers}</strong>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ width: `${((familyMembers.length + 1) / activeSubscription.maxUsers) * 100}%`, height: '100%', background: 'var(--color-accent)', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>

            {familyError ? <div className="catalog-error" style={{ marginBottom: '1rem' }}>{familyError}</div> : null}

            {familyLoading ? (
              <div className="catalog-loading">Загрузка участников...</div>
            ) : (
              <div className="profile-subscription__history" style={{ marginBottom: '1.5rem' }}>
                <div className="profile-subscription__history-item" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.8rem' }}>
                  <div>
                    <strong>{fullName} (Вы)</strong>
                    <span>Владелец подписки</span>
                  </div>
                  <span>{form.email}</span>
                </div>
                {familyMembers.map((member) => (
                  <div key={member.userId} className="profile-subscription__history-item" style={{ alignItems: 'center' }}>
                    <div>
                      <strong>{member.firstName} {member.lastName}</strong>
                      <span>Участник семьи</span>
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{member.email}</span>
                    <button
                      type="button"
                      className="btn btn--light"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#ff4d4d' }}
                      onClick={() => handleRemoveFamilyMember(member.userId)}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}

            {familyMembers.length + 1 < activeSubscription.maxUsers ? (
              <form onSubmit={handleAddFamilyMember} className="profile-form" style={{ background: 'transparent', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.8rem' }}>Добавить члена семьи</h3>
                
                {inviteError ? <div className="catalog-error" style={{ marginBottom: '0.8rem' }}>{inviteError}</div> : null}
                {inviteSuccess ? <div className="profile-page__success" style={{ marginBottom: '0.8rem', color: 'var(--color-accent)' }}>{inviteSuccess}</div> : null}
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                  <label className="profile-field" style={{ flex: 1, margin: 0 }}>
                    <span>E-mail пользователя</span>
                    <input
                      type="email"
                      className="catalog-field__input"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value)
                        setInviteError('')
                        setInviteSuccess('')
                      }}
                      placeholder="family@example.com"
                      required
                      disabled={inviteSubmitting}
                    />
                  </label>
                  <button type="submit" className="btn btn--dark" style={{ height: '42px' }} disabled={inviteSubmitting}>
                    {inviteSubmitting ? 'Добавление...' : 'Добавить'}
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Все доступные места в семейной подписке заняты.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="profile-card">
        <div className="profile-card__header">
          <div>
            <h2>История подписок</h2>
            <p>Последние оформления и отмены.</p>
          </div>
        </div>
        <div className="profile-subscription__history">
          {subscriptions.length === 0 ? (
            <p className="profile-subscription__empty">История подписок пока пустая.</p>
          ) : (
            subscriptions.map((item) => (
              <div key={item.subscriptionId} className="profile-subscription__history-item">
                <div>
                  <strong>{item.planName}</strong>
                  <span>{formatDate(item.startDate)} - {formatDate(item.endDate)}</span>
                </div>
                <span>{formatSubscriptionStatus(item.status)}</span>
                <span>{formatPrice(item.paidAmount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )

  const renderSecurityTab = () => (
    <div className="profile-card">
      <div className="profile-card__header">
        <div>
          <h2>Безопасность аккаунта</h2>
          <p>Управление паролем и безопасностью учетной записи.</p>
        </div>
      </div>

      {securityError && <div className="catalog-error" style={{ marginTop: '1rem' }}>{securityError}</div>}
      {securitySuccess && <div className="profile-page__success" style={{ marginTop: '1rem' }}>{securitySuccess}</div>}

      {securityPhase === 'request' ? (
        <form onSubmit={handleRequestSecurityCode} className="profile-form" style={{ background: 'transparent', padding: '0', border: 'none', boxShadow: 'none', marginTop: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Для изменения пароля мы отправим одноразовый 6-значный код подтверждения на вашу электронную почту <strong>{form.email}</strong>.
          </p>
          <div>
            <button type="submit" className="btn btn--dark" disabled={securityLoading}>
              {securityLoading ? 'Отправка...' : 'Получить код подтверждения'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="profile-form" style={{ background: 'transparent', padding: '0', border: 'none', boxShadow: 'none', marginTop: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Введите код подтверждения, полученный на почту <strong>{form.email}</strong>, и укажите новый пароль.
          </p>

          <label className="profile-field" style={{ marginBottom: '1rem' }}>
            <span>Код подтверждения</span>
            <input
              type="text"
              className="catalog-field__input"
              required
              maxLength={6}
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              disabled={securityLoading}
            />
          </label>

          <div className="profile-form__row" style={{ marginBottom: '1rem' }}>
            <label className="profile-field">
              <span>Новый пароль</span>
              <input
                type="password"
                className="catalog-field__input"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                disabled={securityLoading}
              />
            </label>
            <label className="profile-field">
              <span>Подтвердите новый пароль</span>
              <input
                type="password"
                className="catalog-field__input"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                disabled={securityLoading}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn--dark" disabled={securityLoading}>
              {securityLoading ? 'Сохранение...' : 'Сбросить и установить новый пароль'}
            </button>
            <button
              type="button"
              className="btn btn--light"
              disabled={securityLoading}
              onClick={() => {
                setSecurityPhase('request')
                setSecurityError('')
                setSecuritySuccess('')
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  )

  if (!isAuthorized) {
    return (
      <section className="profile-page profile-page--empty">
        <div className="profile-page__header">
          <div>
            <div className="section-header__title">Профиль</div>
            <div className="section-header__sub">Войдите, чтобы управлять личными данными.</div>
          </div>
          <button type="button" className="btn btn--light" onClick={onBack}>
            В каталог
          </button>
        </div>
        <button type="button" className="btn btn--dark profile-page__auth" onClick={onAuthRequired}>
          Войти
        </button>
      </section>
    )
  }

  return (
    <section className="profile-page">
      <div className="profile-page__header">
        <div>
          <div className="section-header__title">Профиль</div>
          <div className="section-header__sub">{loading ? 'Загрузка данных...' : fullName}</div>
        </div>
        <button type="button" className="btn btn--light" onClick={onBack}>
          В каталог
        </button>
      </div>

      {error ? <div className="catalog-error">{error}</div> : null}
      {success ? <div className="profile-page__success">{success}</div> : null}

      <div className="profile-layout">
        <nav className="profile-sidebar" role="tablist" aria-label="Разделы профиля">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`profile-sidebar__tab ${activeTab === tab.id ? 'profile-sidebar__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button type="button" className="btn btn--light profile-sidebar__logout" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </nav>

        <div className="profile-content">
          {activeTab === 'subscription' && renderSubscriptionTab()}
          {activeTab === 'home' && renderHomeTab()}
          {activeTab === 'security' && renderSecurityTab()}
        </div>
      </div>

      {subscriptionOpen ? (
        <SubscriptionModal
          isAuthorized={isAuthorized}
          onClose={() => setSubscriptionOpen(false)}
          onAuthRequired={onAuthRequired}
          onSubscriptionPurchased={async () => {
            setSubscriptionOpen(false)
            setSuccess('Подписка оформлена.')
            await loadSubscriptions()
          }}
        />
      ) : null}
    </section>
  )
}
