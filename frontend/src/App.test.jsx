import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';
import { fetchProducts } from './api/products.js';

vi.mock('./api/products.js', () => ({
  fetchProducts: vi.fn(),
  isRequestCanceled: (error) => error.code === 'ERR_CANCELED',
}));

const fetchProductsMock = vi.mocked(fetchProducts);
const products = [{
  id: 1,
  id_wb: 123,
  name: 'Sample shirt',
  price_basic: 1000,
  price_with_discount: 800,
  rating: 4.9,
  feedbacks: 1500,
}];

beforeEach(() => {
  fetchProductsMock.mockReset();
});

test('shows loading before the API responds', () => {
  fetchProductsMock.mockReturnValue(new Promise(() => {}));
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading products');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('loads products and identifies the historical sample dataset', async () => {
  fetchProductsMock.mockResolvedValue(products);
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Sample shirt' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(/historical Wildberries sample data/i);
  expect(screen.queryByText('Loading products…')).not.toBeInTheDocument();
  expect(fetchProductsMock).toHaveBeenCalledWith(expect.any(AbortSignal));
});

test('shows a meaningful empty dataset message', async () => {
  fetchProductsMock.mockResolvedValue([]);
  render(<App />);
  expect(await screen.findByText('No products are available in this dataset.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('shows an API failure and retries successfully', async () => {
  fetchProductsMock.mockRejectedValueOnce(new Error('Unavailable'));
  fetchProductsMock.mockResolvedValueOnce(products);
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load products');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: 'Sample shirt' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchProductsMock).toHaveBeenCalledTimes(2);
});

test('aborts a pending request on unmount and ignores its completion', async () => {
  let complete;
  fetchProductsMock.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const { unmount } = render(<App />);
  const signal = fetchProductsMock.mock.calls[0][0];
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { complete(products); });
});
