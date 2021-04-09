const STRIPE_ERRORS: Record<string, Record<string, string>> = {
  missing_payment_information: {
    field: 'cardNumber',
    fieldError: 'Incorrect card number',
  },
  invalid_number: {
    field: 'cardNumber',
    fieldError: 'Incorrect card number',
  },
  number: {
    field: 'cardNumber',
    fieldError: 'Incorrect card number',
  },
  exp_year: {
    field: 'expiry',
    fieldError: 'Incorrect year',
  },
  exp_month: {
    field: 'expiry',
    fieldError: 'Incorrect month',
  },
  invalid_expiry_year: {
    field: 'expiry',
    fieldError: 'Incorrect year',
  },
  invalid_expiry_month: {
    field: 'expiry',
    fieldError: 'Incorrect month',
  },
  cvc: {
    field: 'cvv',
    fieldError: 'Incorrect CVV',
  },
  invalid_cvc: {
    field: 'cvv',
    fieldError: 'Incorrect CVV',
  },
};

export function getStripeError(error: {
  code: string;
  message: string;
  param?: string;
}) {
  const { message, code, param } = error;
  const { field, fieldError, description } = param ? STRIPE_ERRORS[param] : STRIPE_ERRORS[code];
  return {
    field,
    fieldError,
    description: description || message,
  };
}

const SHIPPING_ERRORS: Record<string, Record<string, string>> = {
  ADDRESS_STREET_LINE1_INVALID: {
    field: 'streetLine1',
    fieldError: 'Incorrect street address',
  },
  ADDRESS_STREET_LINE2_INVALID: {
    field: 'streetLine2',
    fieldError: 'Incorrect street address',
  },
  ADDRESS_CITY_INVALID: {
    field: 'city',
    fieldError: 'Incorrect city',
  },
  ADDRESS_COUNTRY_INVALID: {
    field: 'countryIso2',
    fieldError: 'Incorrect country',
  },
  ADDRESS_POSTCODE_INVALID: {
    field: 'postCode',
    fieldError: 'Incorrect post code',
  },
  ADDRESS_STATE_INVALID: {
    field: 'state',
    fieldError: 'Incorrect state',
  },
  REQ_INFO_NAME_INVALID: {
    field: 'fullName',
    fieldError: 'Incorrect name',
  },
  REQ_INFO_PHONE_INVALID: {
    field: 'phone',
    fieldError: 'Incorrect phone',
  },
  REQ_INFO_EMAIL_INVALID: {
    field: 'email',
    fieldError: 'Incorrect email',
  },
};


export function getShippingError(errors: Record<number, { message: string }>) {
  return Object.values(errors).reduce((acc, cur) => {
    const error = SHIPPING_ERRORS[cur.message];
    if (error) {
      acc = {
        ...acc,
        [error.field]: error.fieldError,
      };
    }
    return acc;
  }, {});
}
