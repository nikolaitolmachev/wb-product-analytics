import { Box, Paper, Typography, useTheme } from '@mui/material';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { buildDiscountScatter, buildPriceHistogram } from '../utils/chartData.js';
import { formatDiscount, formatPrice, formatRating } from '../utils/productValues.js';

const countFormatter = new Intl.NumberFormat('ru-RU');
const priceMethod = 'Lower bounds are included; upper bounds are excluded. Ranges adapt to the filtered prices. Prices are not rounded before grouping. Missing, negative and non-finite prices are excluded; valid zero prices are included.';

function ScatterTooltip({ active, payload }) {
  const product = payload?.[0]?.payload;
  if (!active || !product) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, maxWidth: 280, overflowWrap: 'anywhere' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{product.name}</Typography>
      <Typography variant="body2">Discount: {formatDiscount(product.discountRate)}</Typography>
      <Typography variant="body2">Rating: {formatRating(product.rating)}</Typography>
      <Typography variant="body2">Original price: {formatPrice(product.price_basic)}</Typography>
      <Typography variant="body2">Discounted price: {formatPrice(product.price_with_discount)}</Typography>
    </Paper>
  );
}

export default function ProductCharts({ products }) {
  const theme = useTheme();
  const histogram = buildPriceHistogram(products);
  const scatter = buildDiscountScatter(products);
  const priceCount = histogram.reduce((sum, bin) => sum + bin.count, 0);

  return (
    <Box component="section" aria-labelledby="analytics-title">
      <Typography component="h2" variant="h6" id="analytics-title" sx={{ mb: 2 }}>
        Product analytics
      </Typography>
      <Box sx={{ display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Paper component="figure" variant="outlined" aria-labelledby="price-chart-title"
          aria-describedby="price-chart-description price-chart-method"
          sx={{ m: 0, p: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Box component="figcaption" sx={{ mb: 2, minHeight: { md: 84 } }}>
            <Typography component="h3" variant="h6" id="price-chart-title">
              Discounted price distribution
            </Typography>
            <Typography variant="body2" color="text.secondary" id="price-chart-description">
              Distribution of products by discounted price.
            </Typography>
            <Typography id="price-chart-method" hidden>
              {priceMethod}{' '}
              {countFormatter.format(priceCount)} of {countFormatter.format(products.length)} products
              {' '}have valid discounted prices.
            </Typography>
          </Box>
          {histogram.length === 0 ? (
            <Typography role="status">No valid discounted prices are available for this chart.</Typography>
          ) : (
            <>
              <Box sx={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={histogram} barCategoryGap={0} accessibilityLayer
                    aria-label="Discounted price distribution"
                    aria-describedby="price-chart-description price-chart-method"
                    margin={{ top: 12, right: 12, bottom: 24, left: 8 }}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" minTickGap={16} tick={{ fontSize: 11 }} height={56}
                      label={{ value: 'Discounted price (₽)', position: 'insideBottom', offset: -8 }} />
                    <YAxis allowDecimals={false} width={48}
                      label={{ value: 'Product count', angle: -90, position: 'insideLeft' }} />
                    <Tooltip isAnimationActive={false}
                      formatter={(value) => [countFormatter.format(value), 'Products']}
                      labelFormatter={(label) => `${label} ₽`} />
                    <Bar dataKey="count" name="Products" fill={theme.palette.primary.main}
                      isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box component="details" sx={{ mt: 2 }}>
                <Typography component="summary" variant="body2" sx={{ cursor: 'pointer' }}>
                  View distribution counts
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {priceMethod}
                </Typography>
                <Box component="ul" sx={{ pl: 3, mb: 0 }}>
                  {histogram.map((bin) => (
                    <Typography component="li" variant="body2" key={bin.lower}>
                      {bin.label} ₽: {countFormatter.format(bin.count)} products
                    </Typography>
                  ))}
                </Box>
              </Box>
            </>
          )}
        </Paper>

        <Paper component="figure" variant="outlined" aria-labelledby="discount-chart-title"
          aria-describedby="discount-chart-description discount-chart-method"
          sx={{ m: 0, p: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Box component="figcaption" sx={{ mb: 2, minHeight: { md: 84 } }}>
            <Typography component="h3" variant="h6" id="discount-chart-title">
              Discount vs. rating
            </Typography>
            <Typography variant="body2" color="text.secondary" id="discount-chart-description">
              Explore how product discounts relate to customer ratings.
            </Typography>
            <Typography id="discount-chart-method" hidden>
              Each point is one product with valid prices and rating. Overlapping points
              may coincide. This shows observations, not a calculated correlation.{' '}
              {countFormatter.format(scatter.length)} of {countFormatter.format(products.length)} products
              {' '}have valid discount and rating observations. Full values are in the product table below.
            </Typography>
          </Box>
          {scatter.length === 0 ? (
            <Typography role="status">No valid discount and rating observations are available for this chart.</Typography>
          ) : (
            <Box sx={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ScatterChart accessibilityLayer aria-label="Discount vs. rating"
                  aria-describedby="discount-chart-description discount-chart-method"
                  margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="discountPercent" name="Discount" unit="%"
                    domain={[0, 100]} height={56} tick={{ fontSize: 12 }}
                    label={{ value: 'Discount (%)', position: 'insideBottom', offset: -8 }} />
                  <YAxis type="number" dataKey="rating" name="Rating" domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]} width={48}
                    label={{ value: 'Rating', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<ScatterTooltip />} isAnimationActive={false} />
                  <Scatter name="Products" data={scatter} fill={theme.palette.secondary.main}
                    fillOpacity={0.75} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
