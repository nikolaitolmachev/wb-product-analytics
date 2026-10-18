import { useEffect, useState } from 'react';
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
import ProductTable from './components/ProductTable.jsx';

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('loading');

    async function loadProducts() {
      try {
        const data = await fetchProducts(controller.signal);
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
  }, [retryCount]);

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

        {status === 'loading' && (
          <Stack role="status" direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} aria-hidden="true" />
            <Typography>Loading products…</Typography>
          </Stack>
        )}

        {status === 'error' && (
          <Alert severity="error" action={
            <Button color="inherit" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </Button>
          }>
            Unable to load products. Make sure the API is available and try again.
          </Alert>
        )}

        {status === 'success' && products.length === 0 && (
          <Alert severity="info" role="status">
            No products are available in this dataset.
          </Alert>
        )}

        {status === 'success' && products.length > 0 && (
          <ProductTable products={products} />
        )}
      </Stack>
    </Container>
  );
}
