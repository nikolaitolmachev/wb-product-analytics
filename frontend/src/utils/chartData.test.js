import { expect, test } from 'vitest';
import { buildDiscountScatter, buildPriceHistogram } from './chartData.js';
import { getDiscountRate } from './productValues.js';

function priceProducts(prices) {
  return prices.map((price_with_discount, id) => ({ id, price_with_discount }));
}

test('counts decimal boundary prices exactly once in half-open ranges', () => {
  const prices = [0, 0.01, 199.99, 200, 200.01, 399.99, 400, 1599.99, 1600];
  const bins = buildPriceHistogram(priceProducts(prices));
  expect(bins.map((bin) => [bin.lower, bin.upper])).toEqual([
    [0, 200], [200, 400], [400, 600], [600, 800], [800, 1000],
    [1000, 1200], [1200, 1400], [1400, 1600], [1600, 1800],
  ]);
  expect(bins.map((bin) => bin.count)).toEqual([3, 3, 1, 0, 0, 0, 0, 1, 1]);
  for (const price of prices) {
    expect(bins.filter((bin) => price >= bin.lower && price < bin.upper)).toHaveLength(1);
  }
  expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(prices.length);
});

test('retains zero prices and excludes missing or invalid prices without coercion', () => {
  const prices = [0, 0, null, undefined, -1, NaN, Infinity, -Infinity, '10', false];
  expect(buildPriceHistogram(priceProducts(prices))).toEqual([
    { lower: 0, upper: 1, label: '0 – <1', count: 2 },
  ]);
});

test('returns no fabricated bins or points for empty or unusable datasets', () => {
  expect(buildPriceHistogram([])).toEqual([]);
  expect(buildPriceHistogram(priceProducts([null, undefined, -1, Infinity]))).toEqual([]);
  expect(buildDiscountScatter([])).toEqual([]);
  expect(buildDiscountScatter([{ price_basic: null, price_with_discount: null, rating: null }])).toEqual([]);
});

test('keeps bin counts bounded for small and large price scales', () => {
  for (const maximum of [0.01, 1, 8, 9.99, 99.99, 999.99, 10000, 1e6, Number.MAX_VALUE]) {
    const bins = buildPriceHistogram(priceProducts([0, maximum]));
    expect(bins.length).toBeLessThanOrEqual(9);
    expect(bins[0].lower).toBe(0);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  }
});

test('includes individual scatter points with valid zero ratings and 0–100 percent discounts', () => {
  const products = [
    { id: 3, name: 'Free', price_basic: 100, price_with_discount: 0, rating: 0 },
    { id: 1, name: 'Full price', price_basic: 100, price_with_discount: 100, rating: 5 },
    { id: 2, name: 'Discounted', price_basic: 12.5, price_with_discount: 10, rating: 4.5 },
  ];
  const points = buildDiscountScatter(products);
  expect(points.map((point) => [point.id, point.discountPercent, point.rating])).toEqual([
    [1, 0, 5], [2, 20, 4.5], [3, 100, 0],
  ]);
  for (const point of points) {
    const original = products.find((product) => product.id === point.id);
    expect(point.discountRate).toBe(getDiscountRate(original));
    expect(point.name).toBe(original.name);
    expect(point.price_basic).toBe(original.price_basic);
    expect(point.price_with_discount).toBe(original.price_with_discount);
  }
});

test('excludes invalid prices, impossible discounts and invalid ratings from scatter data', () => {
  const valid = { id: 1, price_basic: 100, price_with_discount: 80, rating: 4 };
  const invalid = [
    { price_basic: 0 }, { price_basic: null }, { price_basic: -1 },
    { price_with_discount: 120 }, { price_with_discount: null },
    { price_with_discount: -1 }, { price_with_discount: Infinity },
    { rating: null }, { rating: undefined }, { rating: -1 },
    { rating: 5.1 }, { rating: NaN }, { rating: '4' },
  ].map((fields, index) => ({ ...valid, ...fields, id: index + 2 }));
  expect(buildDiscountScatter([valid, ...invalid]).map((point) => point.id)).toEqual([1]);
});

test('does not mutate products and produces identical chart data after input sorting', () => {
  const products = Object.freeze([
    Object.freeze({ id: 2, name: 'Beta', price_basic: 100, price_with_discount: 80, rating: 4 }),
    Object.freeze({ id: 1, name: 'Alpha', price_basic: 200, price_with_discount: 160, rating: 5 }),
  ]);
  const sorted = [...products].sort((first, second) => first.name.localeCompare(second.name));
  expect(buildPriceHistogram(sorted)).toEqual(buildPriceHistogram(products));
  expect(buildDiscountScatter(sorted)).toEqual(buildDiscountScatter(products));
  expect(products.map((product) => product.id)).toEqual([2, 1]);
});
