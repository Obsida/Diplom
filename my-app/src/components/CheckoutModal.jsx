import { useMemo, useState } from 'react'
import YandexDeliveryMap from './YandexDeliveryMap.jsx'
import PaymentCardStub from './PaymentCardStub.jsx'
import { createEmptyPaymentCard, isPaymentCardStubValid } from './paymentCardStubState.js'
import { useModalBackdropClose } from '../utils/useModalBackdropClose.js'

const formatPrice = (value) => {
  const amount = Number(value)
  if (Number.isNaN(amount)) return '—'
  return `${amount.toLocaleString('ru-RU')} ₽`
}

const parsePrice = (item) => {
  const value = Number(item.priceValue)
  if (!Number.isNaN(value)) return value
  const cleaned = String(item.price ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return Number.isNaN(parsed) ? 0 : parsed
}

const composeDeliveryAddress = (street, apartment, entrance, intercom) => {
  let address = String(street || '').trim()
  const apt = String(apartment || '').trim()
  const ent = String(entrance || '').trim()
  const dom = String(intercom || '').trim()
  const details = []

  if (apt) details.push(`Квартира: ${apt}`)
  if (ent) details.push(`Подъезд: ${ent}`)
  if (dom) details.push(`Домофон: ${dom}`)

  if (details.length) {
    address = address ? `${address}\n${details.join('\n')}` : details.join('\n')
  }

  return address
}

export default function CheckoutModal({
  items,
  isElectronic = false,
  initialAddress = '',
  busy = false,
  onClose,
  onSubmit,
}) {
  const [address, setAddress] = useState(isElectronic ? 'Электронная версия' : initialAddress)
  const [apartment, setApartment] = useState('')
  const [entrance, setEntrance] = useState('')
  const [intercom, setIntercom] = useState('')
  const [card, setCard] = useState(() => createEmptyPaymentCard())
  const [cardError, setCardError] = useState('')
  const backdropClose = useModalBackdropClose(onClose)

  const total = useMemo(() => items.reduce((sum, item) => sum + parsePrice(item), 0), [items])

  return (
    <div className="auth-overlay" role="presentation" {...backdropClose}>
      <div className="auth-modal auth-modal--checkout" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="auth-modal__header">
          <button type="button" className="auth-modal__close auth-modal__close--header" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <h3 className="auth-modal__title">Оформление заказа</h3>
          <p className="auth-modal__subtitle">
            {isElectronic
              ? 'Покупка электронной книги с оплатой банковской картой.'
              : items.some((x) => x.isElectronic)
              ? 'Покупка физической и электронной книг с оплатой банковской картой.'
              : 'Покупка физической книги с оплатой банковской картой.'}
          </p>
        </div>
        <form
          className="auth-modal__form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!isPaymentCardStubValid(card)) {
              setCardError('Заполните тестовые реквизиты банковской карты.')
              return
            }
            onSubmit(isElectronic ? 'Электронная версия' : composeDeliveryAddress(address, apartment, entrance, intercom))
          }}
        >
          <PaymentCardStub
            value={card}
            onChange={(nextCard) => {
              setCard(nextCard)
              if (cardError && isPaymentCardStubValid(nextCard)) {
                setCardError('')
              }
            }}
            disabled={busy}
            title="Оплата заказа"
            hint="Тестовая банковская карта для оформления покупки."
          />
          {cardError ? <div className="subscription-modal__alert subscription-modal__alert--error">{cardError}</div> : null}

          {!isElectronic ? (
            <>
              <YandexDeliveryMap
                value={address}
                onChange={setAddress}
                initialAddress={initialAddress}
              />

              <div className="checkout-extra-fields">
                <label className="checkout-map__field">
                  <span className="checkout-map__label">Номер квартиры</span>
                  <input
                    className="auth-modal__input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="address-line2"
                    placeholder="Например, 42"
                    value={apartment}
                    onChange={(event) => setApartment(event.target.value)}
                  />
                </label>

                <label className="checkout-map__field">
                  <span className="checkout-map__label">Подъезд</span>
                  <input
                    className="auth-modal__input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Номер подъезда"
                    value={entrance}
                    onChange={(event) => setEntrance(event.target.value)}
                  />
                </label>

                <label className="checkout-map__field">
                  <span className="checkout-map__label">Домофон</span>
                  <input
                    className="auth-modal__input"
                    type="text"
                    autoComplete="off"
                    placeholder="Код или как позвонить"
                    value={intercom}
                    onChange={(event) => setIntercom(event.target.value)}
                  />
                </label>
              </div>
            </>
          ) : null}

          <div className="section-header__sub">Книг: {items.length} · Итого: {formatPrice(total)}</div>
          <button className="btn btn--dark auth-modal__submit" disabled={busy} type="submit">
            {busy ? 'Оформляем…' : isElectronic ? 'Оплатить и купить' : 'Оплатить и заказать'}
          </button>
        </form>
      </div>
    </div>
  )
}
