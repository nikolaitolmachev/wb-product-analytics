import { Box, Paper, Typography } from '@mui/material';
import { formatPrice, formatRating, isValidPrice, isValidRating } from '../utils/productValues.js';

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function DashboardStats({ products }) {
  const prices = products.map((product) => product.price_with_discount).filter(isValidPrice);
  const ratings = products.map((product) => product.rating).filter(isValidRating);
  const metrics = [
    { label: 'Total products', value: new Intl.NumberFormat('ru-RU').format(products.length) },
    { label: 'Average discounted price', value: formatPrice(average(prices)) },
    { label: 'Average rating', value: formatRating(average(ratings)) },
  ];

  return (
    <Box component="section" aria-labelledby="summary-title">
      <Typography component="h2" variant="h6" id="summary-title">Current result summary</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Calculated from the displayed historical dataset. Missing values are excluded from averages.
      </Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        {metrics.map(({ label, value }) => (
          <Paper key={label} variant="outlined" sx={{ p: 2 }}>
            <Typography component="dt" color="text.secondary" variant="body2">{label}</Typography>
            <Typography component="dd" variant="h5" sx={{ m: 0, mt: 1 }}>{value}</Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
