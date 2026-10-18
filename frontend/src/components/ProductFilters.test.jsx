import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ProductFilters from './ProductFilters.jsx';

test.each([
  ['Minimum price (₽)', '-1', 'Price must be nonnegative.'],
  ['Maximum price (₽)', '-1', 'Price must be nonnegative.'],
  ['Minimum rating', '-0.1', 'Rating must be between 0 and 5.'],
  ['Minimum rating', '5.1', 'Rating must be between 0 and 5.'],
  ['Minimum feedback count', '-1', 'Feedback count must be a nonnegative whole number.'],
  ['Minimum feedback count', '1.5', 'Feedback count must be a nonnegative whole number.'],
])('rejects invalid %s value %s', (label, value, message) => {
  const onApply = vi.fn();
  render(<ProductFilters onApply={onApply} />);
  const input = screen.getByRole('spinbutton', { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(message);
  expect(onApply).not.toHaveBeenCalled();
});

test('validates price order and allows equal boundaries after correction', () => {
  const onApply = vi.fn();
  render(<ProductFilters onApply={onApply} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price (₽)' }), { target: { value: '100' } });
  const maximum = screen.getByRole('spinbutton', { name: 'Maximum price (₽)' });
  fireEvent.change(maximum, { target: { value: '50' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Product filters' }));
  expect(maximum).toHaveAccessibleDescription('Maximum price must be greater than or equal to minimum price.');
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(maximum, { target: { value: '100' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Product filters' }));
  expect(onApply).toHaveBeenCalledWith({ min_price: 100, max_price: 100 });
});

test('reset clears invalid drafts and applies an unrestricted dataset', () => {
  const onApply = vi.fn();
  render(<ProductFilters onApply={onApply} />);
  const rating = screen.getByRole('spinbutton', { name: 'Minimum rating' });
  fireEvent.change(rating, { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(onApply).toHaveBeenCalledWith({});
  expect(rating).toHaveValue(null);
  expect(rating).toHaveAttribute('aria-invalid', 'false');
});
