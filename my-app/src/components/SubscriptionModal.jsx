import { useEffect, useMemo, useState } from 'react'
import { buySubscription, fetchMySubscriptions, fetchSubscriptionPlans } from '../api'
import PaymentCardStub from './PaymentCardStub.jsx'
import { createEmptyPaymentCard, isPaymentCardStubValid } from './paymentCardStubState.js'
import { useModalBackdropClose } from '../utils/useModalBackdropClose.js'

function formatPrice(value) {
  const amount = Number(value)
  if (Number.isNaN(amount)) return 'Цена уточняется'
  return `${amount.toLocaleString('ru-RU')} ₽`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU')
}

const paymentMethodLabels = {
  card: 'Банковская карта',
  cash: 'Наличные',
  sbp: 'СБП',
  yoomoney: 'ЮMoney',
}

function formatPaymentMethod(method) {
  const key = String(method || '').trim().toLowerCase()
  if (!key) return '—'
  return paymentMethodLabels[key] || method
}

export default function SubscriptionModal({
  onClose,
  isAuthorized,
  onAuthRequired,
  onSubscriptionPurchased,
}) {
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [card, setCard] = useState(() => createEmptyPaymentCard())
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const backdropClose = useModalBackdropClose(onClose)

  useEffect(() => {
    let cancelled = false

    fetchSubscriptionPlans()
      .then((data) => {
        if (cancelled) return
        const nextPlans = Array.isArray(data) ? data : []
        setPlans(nextPlans)
        setSelectedPlanId(nextPlans[0]?.planId ?? null)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError?.message || 'Не удалось загрузить тарифы подписки.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAuthorized) {
      setSubscriptions([])
      return
    }

    let cancelled = false
    setHistoryLoading(true)

    fetchMySubscriptions()
      .then((data) => {
        if (!cancelled) {
          setSubscriptions(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => {
        if (!cancelled) setSubscriptions([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthorized])

  const selectedPlan = useMemo(
    () => plans.find((plan) => Number(plan.planId) === Number(selectedPlanId)) ?? null,
    [plans, selectedPlanId],
  )

  const activeSubscription = subscriptions[0] ?? null
  const needsCardStub = paymentMethod === 'card'

  const handleSubmit = async () => {
    if (!isAuthorized) {
      onAuthRequired?.('Чтобы оформить подписку, сначала войдите в аккаунт.')
      return
    }

    if (!selectedPlan) {
      setError('Выберите тариф подписки.')
      return
    }

    if (needsCardStub && !isPaymentCardStubValid(card)) {
      setError('Заполните тестовые реквизиты банковской карты.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const created = await buySubscription(selectedPlan.planId, paymentMethod)
      setSubscriptions((prev) => [created, ...prev])
      onSubscriptionPurchased?.(created, selectedPlan)
      onClose?.()
    } catch (submitError) {
      setError(submitError?.message || 'Не удалось оформить подписку.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="subscription-overlay" role="presentation" {...backdropClose}>
      <div className="subscription-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="subscription-modal__hero">
          <div>
            <p className="subscription-modal__eyebrow">Premium access</p>
            <h2 className="subscription-modal__title">Покупка подписки</h2>
            <p className="subscription-modal__subtitle">
              Выберите тариф, способ оплаты и получите доступ к расширенному чтению без лишних шагов.
            </p>
          </div>
          <button type="button" className="subscription-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {error ? <div className="subscription-modal__alert subscription-modal__alert--error">{error}</div> : null}

        <div className="subscription-modal__body">
          <section className="subscription-modal__section">
            <div className="subscription-modal__section-head">
              <h3>Тарифы</h3>
            </div>

            {loading ? (
              <p className="subscription-modal__hint">Загружаем доступные тарифы…</p>
            ) : plans.length === 0 ? (
              <p className="subscription-modal__hint">Активные тарифы пока не найдены.</p>
            ) : (
              <div className="subscription-plans">
                {plans.map((plan) => {
                  const isSelected = Number(plan.planId) === Number(selectedPlanId)
                  return (
                    <button
                      key={plan.planId}
                      type="button"
                      className={`subscription-plan ${isSelected ? 'subscription-plan--selected' : ''}`}
                      onClick={() => setSelectedPlanId(plan.planId)}
                    >
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span className="subscription-plan__badge">{plan.durationDays} дней</span>
                        {plan.maxUsers > 1 ? (
                          <span className="subscription-plan__badge" style={{ backgroundColor: '#2e7d32' }}>
                            Семья ({plan.maxUsers} чел.)
                          </span>
                        ) : null}
                      </div>
                      <strong className="subscription-plan__name">{plan.name}</strong>
                      <span className="subscription-plan__price">{formatPrice(plan.basePrice)}</span>
                      <span className="subscription-plan__desc">
                        {plan.description || 'Доступ к подписочным книгам и привилегиям сервиса.'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="subscription-payment">
              <div className="subscription-summary">
                <span className="subscription-summary__label">К оплате</span>
                <strong className="subscription-summary__value">
                  {selectedPlan ? formatPrice(selectedPlan.basePrice) : '—'}
                </strong>
                <span className="subscription-summary__meta">
                  {selectedPlan ? `${selectedPlan.name}, ${selectedPlan.durationDays} дней` : 'Выберите тариф'}
                </span>
              </div>
            </div>

            {needsCardStub ? (
              <PaymentCardStub
                value={card}
                onChange={(nextCard) => {
                  setCard(nextCard)
                  if (error && isPaymentCardStubValid(nextCard)) {
                    setError('')
                  }
                }}
                disabled={submitting}
                title="Оплата подписки"
                hint="Тестовая банковская карта для покупки подписки."
              />
            ) : null}

            {activeSubscription && Number(activeSubscription.maxUsers) === 1 && selectedPlan && Number(selectedPlan.maxUsers) > 1 ? (
              <div style={{
                fontSize: '12.5px',
                padding: '10px 14px',
                background: 'var(--color-secondary)',
                color: 'var(--color-accent)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                marginBottom: '16px',
                lineHeight: '1.4'
              }}>
                ⚠️ <strong>Переход на семейный тариф:</strong> Ваша текущая активная индивидуальная подписка будет заменена на семейную.
              </div>
            ) : null}

            <div className="subscription-modal__actions">
              <button
                type="button"
                className="btn btn--dark"
                onClick={handleSubmit}
                disabled={loading || plans.length === 0 || submitting}
              >
                {submitting ? 'Оформляем…' : activeSubscription && Number(activeSubscription.maxUsers) === 1 && selectedPlan && Number(selectedPlan.maxUsers) > 1 ? 'Перейти на семейный тариф' : 'Купить подписку'}
              </button>
              {!isAuthorized ? (
                <button
                  type="button"
                  className="btn btn--light"
                  onClick={() => onAuthRequired?.('Чтобы купить подписку, сначала войдите в аккаунт.')}
                >
                  Войти для покупки
                </button>
              ) : null}
            </div>
          </section>

          <aside className="subscription-modal__sidebar">
            <div className="subscription-status-card">
              <p className="subscription-status-card__label">Текущий статус</p>
              {isAuthorized ? (
                historyLoading ? (
                  <p className="subscription-modal__hint">Проверяем ваши подписки…</p>
                ) : activeSubscription ? (
                  <>
                    <strong className="subscription-status-card__title">{activeSubscription.planName}</strong>
                    <p className="subscription-status-card__text">Активна до {formatDate(activeSubscription.endDate)}</p>
                    <p className="subscription-status-card__text">Оплата: {formatPrice(activeSubscription.paidAmount)}</p>
                  </>
                ) : (
                  <p className="subscription-status-card__text">Подписка ещё не оформлена.</p>
                )
              ) : (
                <p className="subscription-status-card__text">
                  После входа здесь появится статус вашей подписки и история покупок.
                </p>
              )}
            </div>

            <div className="subscription-history-card">
              <p className="subscription-history-card__label">Последние оформления</p>
              {isAuthorized && subscriptions.length > 0 ? (
                <div className="subscription-history">
                  {subscriptions.slice(0, 3).map((item) => (
                    <div key={item.subscriptionId} className="subscription-history__item">
                      <strong>{item.planName}</strong>
                      <span>{formatDate(item.startDate)} - {formatDate(item.endDate)}</span>
                      <span>{formatPrice(item.paidAmount)} · {formatPaymentMethod(item.paymentMethod)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="subscription-modal__hint">История подписок появится после первой покупки.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
