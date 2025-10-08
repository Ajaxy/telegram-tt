import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
  useRef,
} from '../../lib/teact/teact';

import type { ApiCountry } from '../../api/types';
import type { FormEditDispatch, FormState } from '../../hooks/reducers/usePaymentReducer';

import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Select from '../ui/Select';
import CardInput from './CardInput';
import ExpiryInput from './ExpiryInput';

import './PaymentInfo.scss';

export type OwnProps = {
  state: FormState;
  canSaveCredentials: boolean;
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  countryList: ApiCountry[];
  dispatch: FormEditDispatch;
  isActive?: boolean;
};

const PaymentInfo: FC<OwnProps> = ({
  state,
  canSaveCredentials,
  needCardholderName,
  needCountry,
  needZip,
  countryList,
  dispatch,
  isActive,
}) => {
  const selectCountryRef = useRef<HTMLSelectElement>();

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
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    dispatch({ type: 'changeCvvCode', payload: newValue });
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

  const oldLang = useOldLang();
  const lang = useLang();

  const { formErrors = {} } = state;

  return (
    <div className="PaymentInfo">
      <form>
        <h5>{oldLang('PaymentCardTitle')}</h5>
        <CardInput
          onChange={handleCardNumberChange}
          value={state.cardNumber}
          error={formErrors.cardNumber && lang.withRegular(formErrors.cardNumber)}
          isActive={isActive}
        />
        {needCardholderName && (
          <InputText
            label={oldLang('Checkout.NewCard.CardholderNamePlaceholder')}
            onChange={handleCardholderChange}
            value={state.cardholder}
            inputMode="text"
            tabIndex={0}
            error={formErrors.cardholder && lang.withRegular(formErrors.cardholder)}
          />
        )}
        <section className="inline-inputs">
          <ExpiryInput
            value={state.expiry}
            onChange={handleExpiryChange}
            error={formErrors.expiry && lang.withRegular(formErrors.expiry)}
          />
          <InputText
            label={oldLang('lng_payments_card_cvc')}
            onChange={handleCvvChange}
            value={state.cvv}
            inputMode="numeric"
            maxLength={3}
            tabIndex={0}
            error={formErrors.cvv && lang.withRegular(formErrors.cvv)}
            teactExperimentControlled
          />
        </section>
        {needCountry || needZip ? (
          <h5>{oldLang('PaymentBillingAddress')}</h5>
        ) : undefined}
        <section className="inline-inputs">
          {needCountry && (
            <Select
              label={oldLang('PaymentShippingCountry')}
              onChange={handleCountryChange}
              value={state.billingCountry}
              hasArrow={Boolean(true)}
              id="billing-country"
              error={formErrors.billingCountry && lang.withRegular(formErrors.billingCountry)}
              tabIndex={0}
              ref={selectCountryRef}
            >
              {
                countryList.map(({ defaultName, name }) => (
                  <option
                    value={defaultName}
                    className="county-item"
                    selected={defaultName === state.billingCountry}
                  >
                    {defaultName || name}
                  </option>
                ))
              }
            </Select>
          )}
          {needZip && (
            <InputText
              label={oldLang('PaymentShippingZipPlaceholder')}
              onChange={handleBillingPostCodeChange}
              value={state.billingZip}
              inputMode="text"
              tabIndex={0}
              maxLength={12}
              error={formErrors.billingZip && lang.withRegular(formErrors.billingZip)}
            />
          )}
        </section>
        <div className="checkbox">
          <Checkbox
            label={oldLang('PaymentCardSavePaymentInformation')}
            checked={canSaveCredentials ? state.saveCredentials : false}
            tabIndex={0}
            subLabel={oldLang(canSaveCredentials ? 'Checkout.NewCard.SaveInfoHelp' : 'Checkout.2FA.Text')}
            onChange={handleChangeSaveCredentials}
            disabled={!canSaveCredentials}
          />
        </div>
      </form>
    </div>
  );
};

export default memo(PaymentInfo);
