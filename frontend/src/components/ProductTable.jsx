import { useState } from 'react';
import {
  Link, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import {
  formatDiscount, formatFeedbackCount, formatPrice, formatRating, getDiscountRate,
  isValidFeedbackCount, isValidPrice, isValidRating,
} from '../utils/productValues.js';

const nameCollator = new Intl.Collator('ru-RU', { numeric: true, sensitivity: 'base' });
const columns = [
  { field: 'name', label: 'Product name', align: 'left' },
  { field: 'price_basic', label: 'Original price', align: 'right' },
  { field: 'price_with_discount', label: 'Discounted price', align: 'right' },
  { field: 'discount', label: 'Discount (%)', align: 'right' },
  { field: 'rating', label: 'Rating', align: 'right' },
  { field: 'feedbacks', label: 'Feedback count', align: 'right' },
];

function sortValue(product, field) {
  const value = product[field];
  if (field === 'name') return typeof value === 'string' && value.trim() ? value : null;
  if (field === 'discount') return getDiscountRate(product);
  if (field === 'rating') return isValidRating(value) ? value : null;
  if (field === 'feedbacks') return isValidFeedbackCount(value) ? value : null;
  return isValidPrice(value) ? value : null;
}

function renderProductName(product) {
  if (sortValue(product, 'name') === null) return '—';
  if (product.id_wb == null) return product.name;
  return (
    <Link href={`https://www.wildberries.ru/catalog/${product.id_wb}/detail.aspx`}>
      {product.name}
    </Link>
  );
}

export default function ProductTable({ products }) {
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' });
  const sorted = products.map((product, index) => ({ product, index })).sort((a, b) => {
    const first = sortValue(a.product, sort.field);
    const second = sortValue(b.product, sort.field);
    // Unavailable values stay last in either direction; ties keep API order.
    if (first === null || second === null) {
      if (first === second) return a.index - b.index;
      return first === null ? 1 : -1;
    }
    const comparison = typeof first === 'string'
      ? nameCollator.compare(first, second)
      : first - second;
    return comparison === 0 ? a.index - b.index
      : comparison * (sort.direction === 'asc' ? 1 : -1);
  });

  function handleSort(field) {
    setSort((previous) => ({
      field,
      direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  return (
    <TableContainer component={Paper} variant="outlined" tabIndex={0}
      role="region" aria-label="Scrollable product table">
      <Table aria-label="Historical Wildberries products" sx={{ minWidth: 850 }}>
        <TableHead>
          <TableRow>
            {columns.map(({ field, label, align }) => (
              <TableCell key={field} align={align}
                sortDirection={sort.field === field ? sort.direction : false}>
                <TableSortLabel active={sort.field === field}
                  direction={sort.field === field ? sort.direction : 'asc'}
                  onClick={() => handleSort(field)}>
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map(({ product }) => (
            <TableRow key={product.id}>
              <TableCell>{renderProductName(product)}</TableCell>
              <TableCell align="right">{formatPrice(product.price_basic)}</TableCell>
              <TableCell align="right">{formatPrice(product.price_with_discount)}</TableCell>
              <TableCell align="right">{formatDiscount(getDiscountRate(product))}</TableCell>
              <TableCell align="right">{formatRating(product.rating)}</TableCell>
              <TableCell align="right">{formatFeedbackCount(product.feedbacks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
