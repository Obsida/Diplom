import { EMPTY_PAYMENT_CARD } from './paymentCardStubState.js'

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatCardNumber(value) {
  const digits = digitsOnly(value).slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = digitsOnly(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function maskCardNumber(value) {
  const digits = digitsOnly(value)
  if (!digits) return '•••• •••• •••• ••••'
  return formatCardNumber(digits.padEnd(16, '•'))
}

function maskExpiry(value) {
  return formatExpiry(value) || 'MM/YY'
}

function normalizeHolder(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, 26)
}

export default function PaymentCardStub({
  value,
  onChange,
  disabled = false,
  title = 'Банковская карта',
  hint = 'Тестовая заглушка оплаты. Данные никуда не отправляются.',
}) {
  const card = value || EMPTY_PAYMENT_CARD

  const update = (patch) => {
    onChange?.({
      ...card,
      ...patch,
    })
  }

  return (
    <section className="payment-card-stub" aria-label="Форма банковской карты">
      <div className="payment-card-stub__visual" aria-hidden="true">
        <div className="payment-card-stub__brand">BOOKSBERI BANK</div>
        <div className="payment-card-stub__chip" />
        <div className="payment-card-stub__number">{maskCardNumber(card.number)}</div>
        <div className="payment-card-stub__footer">
          <div>
            <div className="payment-card-stub__caption">CARD HOLDER</div>
            <div className="payment-card-stub__value">{String(card.holder || '').trim() || 'YOUR NAME'}</div>
          </div>
          <div>
            <div className="payment-card-stub__caption">EXPIRES</div>
            <div className="payment-card-stub__value">{maskExpiry(card.expiry)}</div>
          </div>
        </div>
      </div>

      <div className="payment-card-stub__fields">
        <div className="payment-card-stub__head">
          <strong>{title}</strong>
          <span>{hint}</span>
        </div>

        <label className="payment-card-stub__field">
          <span>Номер карты</span>
          <input
            className="auth-modal__input payment-card-stub__input"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={formatCardNumber(card.number)}
            onChange={(event) => update({ number: digitsOnly(event.target.value).slice(0, 16) })}
            disabled={disabled}
            maxLength={19}
            minLength={19}
            pattern="\d{4} \d{4} \d{4} \d{4}"
            required
          />
        </label>

        <label className="payment-card-stub__field">
          <span>Имя держателя</span>
          <input
            className="auth-modal__input payment-card-stub__input"
            type="text"
            autoComplete="cc-name"
            placeholder="IVAN IVANOV"
            value={card.holder}
            onChange={(event) => update({ holder: normalizeHolder(event.target.value) })}
            disabled={disabled}
            maxLength={26}
            minLength={2}
            required
          />
        </label>

        <div className="payment-card-stub__row">
          <label className="payment-card-stub__field">
            <span>Срок</span>
            <input
              className="auth-modal__input payment-card-stub__input payment-card-stub__input--short"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={formatExpiry(card.expiry)}
              onChange={(event) => update({ expiry: digitsOnly(event.target.value).slice(0, 4) })}
              disabled={disabled}
              maxLength={5}
              minLength={5}
              pattern="(0[1-9]|1[0-2])\/\d{2}"
              required
            />
          </label>

          <label className="payment-card-stub__field">
            <span>CVV</span>
            <input
              className="auth-modal__input payment-card-stub__input payment-card-stub__input--short"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={digitsOnly(card.cvv).slice(0, 3)}
              onChange={(event) => update({ cvv: digitsOnly(event.target.value).slice(0, 3) })}
              disabled={disabled}
              maxLength={3}
              minLength={3}
              pattern="\d{3}"
              required
            />
          </label>
        </div>
      </div>
    </section>
  )
}
