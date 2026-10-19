import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import ProductTable from './ProductTable.jsx';

test('sorts prices in both directions with stable ties and missing values last', () => {
  const products = [
    { id: 1, name: 'Beta', price_basic: 100 },
    { id: 2, name: 'Alpha', price_basic: 100 },
    { id: 3, name: 'Missing', price_basic: null },
    { id: 4, name: 'Zero', price_basic: 0 },
  ];
  render(<ProductTable products={products} />);
  const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);
  fireEvent.click(screen.getByRole('button', { name: 'Original price' }));
  expect(names()).toEqual(['Zero', 'Beta', 'Alpha', 'Missing']);
  expect(screen.getByRole('columnheader', { name: 'Original price' })).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(screen.getByRole('button', { name: 'Original price' }));
  expect(names()).toEqual(['Beta', 'Alpha', 'Zero', 'Missing']);
  expect(screen.getByRole('columnheader', { name: 'Original price' })).toHaveAttribute('aria-sort', 'descending');
});

test('distinguishes zero from missing values and rejects impossible discounts', () => {
  const products = [
    { id: 1, name: 'A', price_basic: 100, price_with_discount: 80, rating: 0, feedbacks: 1000 },
    { id: 2, name: 'B', price_basic: 0, price_with_discount: 0, rating: null },
    { id: 3, name: 'C', price_basic: 100, price_with_discount: 120 },
    { id: 4, name: 'D', price_basic: 100, price_with_discount: 0 },
    { id: 5, name: null, price_basic: null, price_with_discount: null },
  ];
  render(<ProductTable products={products} />);
  const rows = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell'));
  const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });
  expect(rows[0][2]).toHaveTextContent(money.format(80).replaceAll('\u00a0', ' '));
  expect(rows[0][3]).toHaveTextContent('20');
  expect(rows[0][4]).toHaveTextContent('0');
  expect(rows[0][5]).toHaveTextContent('1 000');
  expect(rows[1][1]).toHaveTextContent(money.format(0).replaceAll('\u00a0', ' '));
  expect(rows[1][3]).toHaveTextContent('—');
  expect(rows[2][3]).toHaveTextContent('—');
  expect(rows[3][3]).toHaveTextContent('100');
  expect(rows[4].every((cell) => cell.textContent === '—')).toBe(true);
});
