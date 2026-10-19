import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

test('loads products and identifies the stored Wildberries dataset', async () => {
  fetchProductsMock.mockResolvedValue(products);
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Sample shirt' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Product analytics' })).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(
    'Displaying real Wildberries data collected earlier and stored in the application database. Live marketplace data is not included.',
  );
  expect(screen.queryByText('Loading products…')).not.toBeInTheDocument();
  expect(fetchProductsMock).toHaveBeenCalledWith({}, expect.any(AbortSignal));
});

test('shows a meaningful empty dataset message', async () => {
  fetchProductsMock.mockResolvedValue([]);
  render(<App />);
  expect(await screen.findByText('No products match the applied filters.')).toBeInTheDocument();
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
  const signal = fetchProductsMock.mock.calls[0][1];
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { complete(products); });
});

test('applies numeric filters only on submit, skips identical filters and resets', async () => {
  fetchProductsMock.mockResolvedValue(products);
  render(<App />);
  await screen.findByRole('table');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price (₽)' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price (₽)' }), { target: { value: '999.99' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum rating' }), { target: { value: '4.5' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum feedback count' }), { target: { value: '0' } });
  expect(fetchProductsMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await screen.findByRole('table');
  expect(fetchProductsMock).toHaveBeenLastCalledWith({
    min_price: 0, max_price: 999.99, min_rating: 4.5, min_feedbacks: 0,
  }, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(fetchProductsMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  await screen.findByRole('table');
  expect(fetchProductsMock).toHaveBeenLastCalledWith({}, expect.any(AbortSignal));
  expect(screen.getByRole('spinbutton', { name: 'Minimum rating' })).toHaveValue(null);
  expect(fetchProductsMock).toHaveBeenCalledTimes(3);
});

test('sorts locally without requesting new data', async () => {
  fetchProductsMock.mockResolvedValue([
    { ...products[0], id: 1, name: 'Beta', price_basic: 500 },
    { ...products[0], id: 2, name: 'Alpha', price_basic: 1000 },
  ]);
  render(<App />);
  const table = await screen.findByRole('table');
  const names = () => within(table).getAllByRole('link').map((link) => link.textContent);
  expect(names()).toEqual(['Alpha', 'Beta']);
  fireEvent.click(screen.getByRole('button', { name: 'Original price' }));
  expect(names()).toEqual(['Beta', 'Alpha']);
  fireEvent.click(screen.getByRole('button', { name: 'Original price' }));
  expect(names()).toEqual(['Alpha', 'Beta']);
  expect(fetchProductsMock).toHaveBeenCalledTimes(1);
});

test('hides previous results while applying filters and after a failed request', async () => {
  let fail;
  fetchProductsMock.mockResolvedValueOnce(products).mockReturnValueOnce(
    new Promise((resolve, reject) => { fail = reject; }),
  );
  render(<App />);
  await screen.findByRole('table');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum rating' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading products');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Product Overview' })).not.toBeInTheDocument();
  await act(async () => { fail(new Error('Unavailable')); });
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load products');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fetchProductsMock.mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No products match the applied filters.');
  expect(fetchProductsMock).toHaveBeenLastCalledWith({ min_rating: 5 }, expect.any(AbortSignal));
});

test('cancels obsolete filter requests and ignores their late responses', async () => {
  let completeOld;
  fetchProductsMock.mockReturnValueOnce(new Promise((resolve) => { completeOld = resolve; }));
  fetchProductsMock.mockResolvedValueOnce([{ ...products[0], name: 'Current result' }]);
  render(<App />);
  const oldSignal = fetchProductsMock.mock.calls[0][1];
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum rating' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(oldSignal.aborted).toBe(true);
  await screen.findByRole('link', { name: 'Current result' });
  await act(async () => { completeOld(products); });
  expect(screen.queryByRole('link', { name: 'Sample shirt' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Current result' })).toBeInTheDocument();
});
