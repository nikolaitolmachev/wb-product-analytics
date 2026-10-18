import {
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'RUB',
});

function formatPrice(value) {
  return value == null ? '—' : priceFormatter.format(value);
}

export default function ProductTable({ products }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-label="Historical Wildberries products" sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell>Product</TableCell>
            <TableCell align="right">Current price</TableCell>
            <TableCell align="right">Original price</TableCell>
            <TableCell align="right">Rating</TableCell>
            <TableCell align="right">Reviews</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <Link href={`https://www.wildberries.ru/catalog/${product.id_wb}/detail.aspx`}>
                  {product.name}
                </Link>
              </TableCell>
              <TableCell align="right">{formatPrice(product.price_with_discount)}</TableCell>
              <TableCell align="right">{formatPrice(product.price_basic)}</TableCell>
              <TableCell align="right">{product.rating ?? '—'}</TableCell>
              <TableCell align="right">{product.feedbacks ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
