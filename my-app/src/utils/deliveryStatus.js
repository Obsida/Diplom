export const DELIVERY_STATUS_LABELS = {
  created: 'создан',
  processing: 'в обработке',
  shipped: 'отправлен',
  delivered: 'доставлен',
  cancelled: 'отменён',
  completed: 'завершён',
}

export function formatDeliveryStatus(status) {
  const key = String(status || 'created').trim().toLowerCase()
  return DELIVERY_STATUS_LABELS[key] || status || DELIVERY_STATUS_LABELS.created
}
