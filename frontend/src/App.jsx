import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { fetchProducts, isRequestCanceled } from './api/products.js';
import ProductFilters from './components/ProductFilters.jsx';
import DashboardStats from './components/DashboardStats.jsx';

const ProductCharts = lazy(() => import('./components/ProductCharts.jsx'));
const ProductTable = lazy(() => import('./components/ProductTable.jsx'));

const filterNames = ['min_price', 'max_price', 'min_rating', 'min_feedbacks'];

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState({});

  function applyFilters(filters) {
    if (filterNames.every((name) => filters[name] === appliedFilters[name])) return;
    setStatus('loading');
    setAppliedFilters(filters);
  }

  function retryProducts() {
    setStatus('loading');
    setRetryCount((count) => count + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('loading');

    async function loadProducts() {
      try {
        const data = await fetchProducts(appliedFilters, controller.signal);
        if (active) {
          setProducts(data);
          setStatus('success');
        }
      } catch (error) {
        if (active && !isRequestCanceled(error)) {
          setStatus('error');
        }
      }
    }

    loadProducts();
    return () => {
      active = false;
      controller.abort();
    };
  }, [appliedFilters, retryCount]);

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={3}>
        <Box component="header">
          <Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            Wildberries Product Analytics
          </Typography>
          <Typography color="text.secondary">
            Explore product prices, ratings, and discounts.
          </Typography>
        </Box>

        <Alert severity="info" role="note">
          Displaying real Wildberries data collected earlier and stored in the
          application database. Live marketplace data is not included.
        </Alert>

        <ProductFilters onApply={applyFilters} />

        {status === 'loading' && (
          <Stack role="status" direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} aria-hidden="true" />
            <Typography>Loading products…</Typography>
          </Stack>
        )}

        {status === 'error' && (
          <Alert severity="error" action={
            <Button color="inherit" onClick={retryProducts}>
              Retry
            </Button>
          }>
            Unable to load products. Make sure the API is available and try again.
          </Alert>
        )}

        {status === 'success' && <DashboardStats products={products} />}

        {status === 'success' && products.length === 0 && (
          <Alert severity="info" role="status">
            No products match the applied filters.
          </Alert>
        )}

        {status === 'success' && products.length > 0 && (
          <>
            <Suspense fallback={
              <Box role="status" sx={{ minHeight: { xs: 960, md: 552 } }}>
                <Typography>Loading charts…</Typography>
              </Box>
            }>
              <ProductCharts products={products} />
            </Suspense>
            <Suspense fallback={
              <Box role="status" sx={{ minHeight: 320 }}>
                <Typography>Loading product table…</Typography>
              </Box>
            }>
              <ProductTable products={products} />
            </Suspense>
          </>
        )}
      </Stack>
    </Container>
  );
}
