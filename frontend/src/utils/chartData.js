import { getDiscountRate, isValidPrice, isValidRating } from './productValues.js';

const rangeFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function buildPriceHistogram(products) {
  const prices = products.map((product) => product.price_with_discount).filter(isValidPrice);
  if (prices.length === 0) return [];

  const maximum = Math.max(...prices);
  // Nice whole-ruble widths keep decimal observations intact and limit the chart to nine bins.
  const targetWidth = Math.max(1, maximum / 8);
  const magnitude = 10 ** Math.floor(Math.log10(targetWidth));
  const width = [1, 2, 5, 10].map((factor) => factor * magnitude)
    .find((candidate) => candidate >= targetWidth);
  const bins = Array.from({ length: Math.floor(maximum / width) + 1 }, (_, index) => {
    const lower = index * width;
    const upper = (index + 1) * width;
    const label = Number.isFinite(upper)
      ? `${rangeFormatter.format(lower)} – <${rangeFormatter.format(upper)}`
      : `≥${rangeFormatter.format(lower)}`;
    return { lower, upper, label, count: 0 };
  });
  for (const price of prices) {
    bins[Math.floor(price / width)].count += 1;
  }
  return bins;
}

export function buildDiscountScatter(products) {
  const points = [];
  for (const product of products) {
    const discountRate = getDiscountRate(product);
    if (discountRate === null || !isValidRating(product.rating)) continue;
    points.push({
      id: product.id,
      name: product.name || 'Unnamed product',
      discountRate,
      discountPercent: discountRate * 100,
      rating: product.rating,
      price_basic: product.price_basic,
      price_with_discount: product.price_with_discount,
    });
  }
  // Canonical point order also makes overlapping points independent of input sorting.
  return points.sort((first, second) => first.id - second.id);
}
