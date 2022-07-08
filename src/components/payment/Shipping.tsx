import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, memo, useMemo, useEffect,
} from '../../lib/teact/teact';

import type { ShippingOption } from '../../types';

import { formatCurrency } from '../../util/formatCurrency';
import type { FormState, FormEditDispatch } from '../../hooks/reducers/usePaymentReducer';
import useLang from '../../hooks/useLang';

import RadioGroup from '../ui/RadioGroup';

import './Shipping.scss';

export type OwnProps = {
  state: FormState;
  shippingOptions: ShippingOption[];
  currency: string;
  dispatch: FormEditDispatch;
};

const Shipping: FC<OwnProps> = ({
  state,
  shippingOptions,
  currency,
  dispatch,
}) => {
  const lang = useLang();

  useEffect(() => {
    if (!shippingOptions || state.shipping) {
      return;
    }
    dispatch({ type: 'changeShipping', payload: shippingOptions[0].id });
  }, [shippingOptions, state.shipping, dispatch]);

  const handleShippingSelect = useCallback((value) => {
    dispatch({ type: 'changeShipping', payload: value });
  }, [dispatch]);

  const options = useMemo(() => (shippingOptions.map(({ id: value, title: label, amount }) => ({
    label,
    subLabel: formatCurrency(amount, currency, lang.code),
    value,
  }))), [shippingOptions, currency, lang.code]);

  return (
    <div className="Shipping">
      <form>
        <p>{lang('PaymentShippingMethod')}</p>
        <RadioGroup
          name="shipping-options"
          options={options}
          onChange={handleShippingSelect}
          selected={state.shipping}
        />
      </form>
    </div>
  );
};

export default memo(Shipping);
