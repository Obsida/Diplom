export const EMPTY_PAYMENT_CARD = {
  number: '',
  holder: '',
  expiry: '',
  cvv: '',
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function createEmptyPaymentCard() {
  return { ...EMPTY_PAYMENT_CARD }
}

export function isPaymentCardStubValid(card) {
  const number = digitsOnly(card?.number)
  const holder = String(card?.holder || '').trim()
  const expiry = digitsOnly(card?.expiry)
  const cvv = digitsOnly(card?.cvv)
  const month = Number(expiry.slice(0, 2))

  return (
    number.length === 16 &&
    holder.length >= 2 &&
    expiry.length === 4 &&
    month >= 1 &&
    month <= 12 &&
    cvv.length >= 3
  )
}
