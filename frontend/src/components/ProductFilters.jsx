import { useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';

const emptyFields = { min_price: '', max_price: '', min_rating: '', min_feedbacks: '' };
const fields = [
  { name: 'min_price', label: 'Minimum price (₽)', input: { min: 0, step: 'any' } },
  { name: 'max_price', label: 'Maximum price (₽)', input: { min: 0, step: 'any' } },
  { name: 'min_rating', label: 'Minimum rating', input: { min: 0, max: 5, step: 'any' } },
  { name: 'min_feedbacks', label: 'Minimum feedback count', input: { min: 0, step: 1 } },
];

function validateFields(values) {
  const params = {};
  const errors = {};
  for (const { name } of fields) {
    const text = values[name].trim();
    if (text === '') continue;
    const value = Number(text);
    if (!Number.isFinite(value)) {
      errors[name] = 'Enter a finite number.';
    } else if (name === 'min_rating' && (value < 0 || value > 5)) {
      errors[name] = 'Rating must be between 0 and 5.';
    } else if (name === 'min_feedbacks' && (!Number.isSafeInteger(value) || value < 0)) {
      errors[name] = 'Feedback count must be a nonnegative whole number.';
    } else if (value < 0) {
      errors[name] = 'Price must be nonnegative.';
    } else {
      params[name] = value;
    }
  }
  if (params.min_price !== undefined && params.max_price !== undefined &&
      params.min_price > params.max_price) {
    errors.max_price = 'Maximum price must be greater than or equal to minimum price.';
  }
  return { params, errors };
}

export default function ProductFilters({ onApply }) {
  const [values, setValues] = useState(emptyFields);
  const [submitted, setSubmitted] = useState(false);
  const { params, errors } = validateFields(values);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length === 0) onApply(params);
  }

  function handleReset() {
    setValues(emptyFields);
    setSubmitted(false);
    onApply({});
  }

  return (
    <Paper component="form" aria-label="Product filters" variant="outlined"
      noValidate onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h6">Product filters</Typography>
        <Typography variant="body2" color="text.secondary">
          Leave fields blank for no restriction. Results reflect applied filters;
          edits take effect only after Apply filters.
        </Typography>
        <Box sx={{ display: 'grid', gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {fields.map(({ name, label, input }) => (
            <TextField key={name} label={label} type="number" value={values[name]}
              slotProps={{ htmlInput: input }}
              onChange={(event) => setValues((previous) => ({
                ...previous, [name]: event.target.value,
              }))}
              error={submitted && Boolean(errors[name])}
              helperText={submitted && errors[name] ? errors[name] : 'Optional'}
            />
          ))}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button type="submit" variant="contained">Apply filters</Button>
          <Button type="button" variant="outlined" onClick={handleReset}>Reset filters</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
