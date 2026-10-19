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
            Explore the included product dataset.
          </Typography>
        </Box>

        <Alert severity="info" role="note">
          Product information is loaded from the current application database.
          The bundled database contains historical Wildberries sample data,
          not live marketplace information.
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
            <Suspense fallback={<Typography role="status">Loading charts…</Typography>}>
              <ProductCharts products={products} />
            </Suspense>
            <Suspense fallback={<Typography role="status">Loading product table…</Typography>}>
              <ProductTable products={products} />
            </Suspense>
          </>
        )}
      </Stack>
    </Container>
  );
}
