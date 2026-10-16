import type { ApiFieldError } from '../../api/types';

const STRIPE_ERRORS: Record<string, ApiFieldError> = {
  missing_payment_information: {
    field: 'cardNumber',
    messageKey: { key: 'PaymentIncorrectCardNumber' },
  },
  invalid_number: {
    field: 'cardNumber',
    messageKey: { key: 'PaymentIncorrectCardNumber' },
  },
  number: {
    field: 'cardNumber',
    messageKey: { key: 'PaymentIncorrectCardNumber' },
  },
  exp_year: {
    field: 'expiry',
    messageKey: { key: 'PaymentIncorrectYear' },
  },
  exp_month: {
    field: 'expiry',
    messageKey: { key: 'PaymentIncorrectMonth' },
  },
  invalid_expiry_year: {
    field: 'expiry',
    messageKey: { key: 'PaymentIncorrectYear' },
  },
  invalid_expiry_month: {
    field: 'expiry',
    messageKey: { key: 'PaymentIncorrectMonth' },
  },
  cvc: {
    field: 'cvv',
    messageKey: { key: 'PaymentIncorrectCvv' },
  },
  invalid_cvc: {
    field: 'cvv',
    messageKey: { key: 'PaymentIncorrectCvv' },
  },
};

export function getStripeError(error: {
  code: string;
  message: string;
  param?: string;
}) {
  const { message: description, code, param } = error;
  const fieldError = (param && STRIPE_ERRORS[param]) || STRIPE_ERRORS[code];

  return {
    field: fieldError?.field,
    messageKey: fieldError?.messageKey,
    descriptionKey: fieldError?.messageKey,
    description,
  };
}
