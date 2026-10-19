import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import { fetchProducts } from './products.js';

afterEach(() => { vi.restoreAllMocks(); });

test('passes exact backend filters, timeout and cancellation signal to Axios', async () => {
  const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: [] });
  const { signal } = new AbortController();
  const filters = { min_price: 0, max_price: 500.5, min_rating: 4, min_feedbacks: 0 };
  await expect(fetchProducts(filters, signal)).resolves.toEqual([]);
  expect(get).toHaveBeenCalledWith('/api/products/', { params: filters, timeout: 10000, signal });
});

test('rejects a malformed API envelope and propagates request failures', async () => {
  const get = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: {} });
  await expect(fetchProducts({})).rejects.toThrow('unexpected response');
  const failure = new Error('Unavailable');
  get.mockRejectedValueOnce(failure);
  await expect(fetchProducts({})).rejects.toBe(failure);
});
