import React, {
  FC, useCallback, memo, useRef, useEffect,
} from '../../lib/teact/teact';

import { FormState, FormEditDispatch } from '../../hooks/reducers/usePaymentReducer';
import useLang from '../../hooks/useLang';
import countryList from '../../util/countries';

import InputText from '../ui/InputText';
import Checkbox from '../ui/Checkbox';
import Select from '../ui/Select';
import ExpiryInput from './ExpiryInput';
import CardInput from './CardInput';

import './PaymentInfo.scss';

export type OwnProps = {
  state: FormState;
  canSaveCredentials: boolean;
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  dispatch: FormEditDispatch;
};

const PaymentInfo: FC<OwnProps> = ({
  state,
  canSaveCredentials,
  needCardholderName,
  needCountry,
  needZip,
  dispatch,
}) => {
  // eslint-disable-next-line no-null/no-null
  const selectCountryRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (selectCountryRef.current
      && selectCountryRef.current.value !== state.billingCountry) {
      selectCountryRef.current.value = state.billingCountry;
    }
  }, [state.billingCountry]);

  const handleCardNumberChange = useCallback((value) => {
    dispatch({ type: 'changeCardNumber', payload: value });
  }, [dispatch]);

  const handleCardholderChange = useCallback((e) => {
    dispatch({ type: 'changeCardholder', payload: e.target.value.toUpperCase() });
  }, [dispatch]);

  const handleExpiryChange = useCallback((value) => {
    dispatch({ type: 'changeExpiryDate', payload: value });
  }, [dispatch]);

  const handleCvvChange = useCallback((e) => {
    dispatch({ type: 'changeCvvCode', payload: e.target.value });
  }, [dispatch]);

  const handleCountryChange = useCallback((e) => {
    dispatch({ type: 'changeBillingCountry', payload: e.target.value });
  }, [dispatch]);

  const handleBillingPostCodeChange = useCallback((e) => {
    dispatch({ type: 'changeBillingZip', payload: e.target.value });
  }, [dispatch]);

  const handleChangeSaveCredentials = useCallback((e) => {
    dispatch({ type: 'changeSaveCredentials', payload: e.target.value });
  }, [dispatch]);

  const lang = useLang();

  const { formErrors = {} } = state;

  return (
    <div className="PaymentInfo">
      <form>
        <h5>{lang('PaymentCardTitle')}</h5>
        <CardInput
          onChange={handleCardNumberChange}
          value={state.cardNumber}
          error={formErrors.cardNumber}
        />
        { needCardholderName && (
          <InputText
            label="Name on card"
            onChange={handleCardholderChange}
            value={state.cardholder}
            inputMode="text"
            error={formErrors.cardholder}
          />
        )}
        <section className="inline-inputs">
          <ExpiryInput
            value={state.expiry}
            onChange={handleExpiryChange}
            error={formErrors.expiry}
          />
          <InputText
            label="CVV code"
            onChange={handleCvvChange}
            value={state.cvv}
            inputMode="numeric"
            maxLength={3}
            error={formErrors.cvv}
          />
        </section>
        { needCountry || needZip ? (
          <h5>{lang('PaymentBillingAddress')}</h5>
        ) : undefined }
        { needCountry && (
          <Select
            label="Country"
            placeholder="Country"
            onChange={handleCountryChange}
            value={state.billingCountry}
            hasArrow={Boolean(true)}
            id="billing-country"
            error={formErrors.billingCountry}
            ref={selectCountryRef}
          >
            {
              countryList.map(({ name }) => (
                <option
                  value={name}
                  className="county-item"
                >
                  {name}
                </option>
              ))
            }
          </Select>
        ) }
        { needZip && (
          <InputText
            label="Post Code"
            onChange={handleBillingPostCodeChange}
            value={state.billingZip}
            inputMode="text"
            error={formErrors.billingZip}
          />
        )}
        { canSaveCredentials && (
          <Checkbox
            label={lang('PaymentCardSavePaymentInformation')}
            checked={state.saveCredentials}
            onChange={handleChangeSaveCredentials}
          />
        ) }
      </form>
    </div>
  );
};

export default memo(PaymentInfo);
