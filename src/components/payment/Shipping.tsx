import React, {
  FC, useCallback, memo, useMemo, useEffect,
} from '../../lib/teact/teact';

import { ShippingOption } from '../../types/index';

import { FormState, FormEditDispatch } from '../../hooks/reducers/usePaymentReducer';

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
    subLabel: `${currency} ${String(amount / 100)}`,
    value,
  }))), [shippingOptions, currency]);

  return (
    <div className="Shipping">
      <form>
        <p>Select shipping method</p>
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
