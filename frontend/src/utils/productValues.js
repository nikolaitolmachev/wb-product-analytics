const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
});
const countFormatter = new Intl.NumberFormat('ru-RU');
const ratingFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const discountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function isValidPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isValidRating(value) {
  return isValidPrice(value) && value <= 5;
}

export function isValidFeedbackCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function getDiscountRate(product) {
  const original = product.price_basic;
  const discounted = product.price_with_discount;
  if (!isValidPrice(original) || !isValidPrice(discounted) ||
      original === 0 || discounted > original) {
    return null;
  }
  return (original - discounted) / original;
}

export function formatPrice(value) {
  return isValidPrice(value) ? priceFormatter.format(value) : '—';
}

export function formatRating(value) {
  return isValidRating(value) ? ratingFormatter.format(value) : '—';
}

export function formatFeedbackCount(value) {
  return isValidFeedbackCount(value) ? countFormatter.format(value) : '—';
}

export function formatDiscount(value) {
  return value == null ? '—' : discountFormatter.format(value);
}
