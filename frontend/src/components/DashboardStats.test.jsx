import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import DashboardStats from './DashboardStats.jsx';

test('calculates averages from valid observations, retaining zero values', () => {
  render(<DashboardStats products={[
    { price_with_discount: 0, rating: 0 },
    { price_with_discount: 200, rating: 4 },
    { price_with_discount: null, rating: null },
    {},
    { price_with_discount: -1, rating: 6 },
  ]} />);
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByText('100,00 ₽', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

test.each([
  { products: [] },
  { products: [{ price_with_discount: null, rating: null }] },
])(
  'shows unavailable averages when the dataset has no valid observations: $products',
  ({ products }) => {
    render(<DashboardStats products={products} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText(String(products.length))).toBeInTheDocument();
  },
);
