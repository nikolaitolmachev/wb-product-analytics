import axios from 'axios';

export async function fetchProducts(signal) {
  const response = await axios.get('/api/products/', {
    timeout: 10000,
    signal,
  });
  if (!Array.isArray(response.data)) {
    throw new Error('The product API returned an unexpected response.');
  }
  return response.data;
}

export function isRequestCanceled(error) {
  return axios.isCancel(error);
}
