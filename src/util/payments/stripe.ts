import type { ApiFieldError } from '../../api/types';

const STRIPE_ERRORS: Record<string, ApiFieldError> = {
  missing_payment_information: {
    field: 'cardNumber',
    message: 'Incorrect card number',
  },
  invalid_number: {
    field: 'cardNumber',
    message: 'Incorrect card number',
  },
  number: {
    field: 'cardNumber',
    message: 'Incorrect card number',
  },
  exp_year: {
    field: 'expiry',
    message: 'Incorrect year',
  },
  exp_month: {
    field: 'expiry',
    message: 'Incorrect month',
  },
  invalid_expiry_year: {
    field: 'expiry',
    message: 'Incorrect year',
  },
  invalid_expiry_month: {
    field: 'expiry',
    message: 'Incorrect month',
  },
  cvc: {
    field: 'cvv',
    message: 'Incorrect CVV',
  },
  invalid_cvc: {
    field: 'cvv',
    message: 'Incorrect CVV',
  },
};

export function getStripeError(error: {
  code: string;
  message: string;
  param?: string;
}) {
  const { message: description, code, param } = error;
  const { field, message } = param ? STRIPE_ERRORS[param] : STRIPE_ERRORS[code];

  return { field, message, description };
}
