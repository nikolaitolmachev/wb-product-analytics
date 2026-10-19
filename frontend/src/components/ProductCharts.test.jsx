import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ProductCharts from './ProductCharts.jsx';

vi.mock('recharts', async (importOriginal) => {
  const charts = await importOriginal();
  return {
    ...charts,
    // JSDOM has no layout; use Recharts' real fixed-size container in these tests.
    ResponsiveContainer: ({ children }) => (
      <charts.ResponsiveContainer width={640} height={320}>
        {children}
      </charts.ResponsiveContainer>
    ),
  };
});

test('renders both charts with units, descriptions and accessible histogram counts', () => {
  render(<ProductCharts products={[
    { id: 1, name: 'Shirt', price_basic: 1000, price_with_discount: 800, rating: 4.5 },
    { id: 2, name: 'Free item', price_basic: 100, price_with_discount: 0, rating: 0 },
  ]} />);
  const histogram = screen.getByRole('figure', { name: 'Discounted price distribution' });
  const scatter = screen.getByRole('figure', { name: 'Discount vs. rating' });
  expect(within(histogram).getByText('Discounted price (₽)')).toBeInTheDocument();
  expect(within(histogram).getByText('Product count')).toBeInTheDocument();
  expect(within(histogram).getByText('View distribution counts')).toBeInTheDocument();
  expect(within(scatter).getByText('Discount (%)')).toBeInTheDocument();
  expect(within(scatter).getByText('Rating')).toBeInTheDocument();
  expect(scatter).toHaveAccessibleDescription(/not a calculated correlation/);
  expect(histogram).toHaveAccessibleDescription(/Lower bounds are included/);
});

test('explains missing chart observations without drawing fabricated values', () => {
  render(<ProductCharts products={[{ id: 1, price_with_discount: null, rating: null }]} />);
  expect(screen.getByText('No valid discounted prices are available for this chart.')).toBeInTheDocument();
  expect(screen.getByText('No valid discount and rating observations are available for this chart.')).toBeInTheDocument();
  expect(screen.queryByText('View distribution counts')).not.toBeInTheDocument();
});
