import type { FC } from '../../lib/teact/teact';
import {
  memo,
  useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import type { ApiCountry } from '../../api/types';
import type { FormEditDispatch, FormState } from '../../hooks/reducers/usePaymentReducer';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import focusNoScroll from '../../util/focusNoScroll';

import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Select from '../ui/Select';

import './ShippingInfo.scss';

export type OwnProps = {
  state: FormState;
  needEmail: boolean;
  needPhone: boolean;
  needName: boolean;
  needAddress: boolean;
  countryList: ApiCountry[];
  dispatch: FormEditDispatch;
};

const ShippingInfo: FC<OwnProps> = ({
  state,
  needEmail,
  needPhone,
  needName,
  needAddress,
  countryList,
  dispatch,
}) => {
  const inputRef = useRef<HTMLInputElement>();
  const phoneRef = useRef<HTMLInputElement>();
  const selectCountryRef = useRef<HTMLSelectElement>();

  useEffect(() => {
    if (selectCountryRef.current
      && selectCountryRef.current.value !== state.countryIso2) {
      selectCountryRef.current.value = state.countryIso2;
    }
  }, [state.countryIso2]);

  const oldLang = useOldLang();
  const lang = useLang();

  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    requestMeasure(() => {
      focusNoScroll(inputRef.current);
    });
  }, [inputRef]);

  const handleAddress1Change = useCallback((e) => {
    dispatch({ type: 'changeAddress1', payload: e.target.value });
  }, [dispatch]);

  const handleAddress2Change = useCallback((e) => {
    dispatch({ type: 'changeAddress2', payload: e.target.value });
  }, [dispatch]);

  const handleCityChange = useCallback((e) => {
    dispatch({ type: 'changeCity', payload: e.target.value });
  }, [dispatch]);

  const handleStateChange = useCallback((e) => {
    dispatch({ type: 'changeState', payload: e.target.value });
  }, [dispatch]);

  const handleCountryChange = useCallback((e) => {
    dispatch({ type: 'changeCountry', payload: countryList.find((country) => country.iso2 === e.target.value) });
  }, [countryList, dispatch]);

  const handlePostCodeChange = useCallback((e) => {
    dispatch({ type: 'changePostCode', payload: e.target.value });
  }, [dispatch]);

  const handleFullNameChange = useCallback((e) => {
    dispatch({ type: 'changeFullName', payload: e.target.value });
  }, [dispatch]);

  const handleEmailChange = useCallback((e) => {
    dispatch({ type: 'changeEmail', payload: e.target.value });
  }, [dispatch]);

  const handlePhoneChange = useCallback((e) => {
    let { value } = e.target;
    value = `+${value.replace(/\D/g, '')}`;
    if (phoneRef.current) {
      phoneRef.current.value = value;
    }
    dispatch({ type: 'changePhone', payload: value });
  }, [dispatch]);

  const handleSaveInfoChange = useCallback((e) => {
    dispatch({ type: 'changeSaveInfo', payload: e.target.value });
  }, [dispatch]);

  const { formErrors } = state;
  return (
    <div className="ShippingInfo">
      <form>
        {needAddress ? (
          <div>
            <h5>{oldLang('PaymentShippingAddress')}</h5>
            <InputText
              ref={inputRef}
              label={oldLang('PaymentShippingAddress1Placeholder')}
              onChange={handleAddress1Change}
              value={state.streetLine1}
              inputMode="text"
              tabIndex={0}
              error={formErrors.streetLine1 && lang.withRegular(formErrors.streetLine1)}
            />
            <InputText
              label={oldLang('PaymentShippingAddress2Placeholder')}
              onChange={handleAddress2Change}
              value={state.streetLine2}
              inputMode="text"
              tabIndex={0}
              error={formErrors.streetLine2 && lang.withRegular(formErrors.streetLine2)}
            />
            <InputText
              label={oldLang('PaymentShippingCityPlaceholder')}
              onChange={handleCityChange}
              value={state.city}
              inputMode="text"
              tabIndex={0}
              error={formErrors.city && lang.withRegular(formErrors.city)}
            />
            <InputText
              label={oldLang('PaymentShippingStatePlaceholder')}
              onChange={handleStateChange}
              value={state.state}
              inputMode="text"
              error={formErrors.state && lang.withRegular(formErrors.state)}
            />
            <Select
              label={oldLang('PaymentShippingCountry')}
              onChange={handleCountryChange}
              value={state.countryIso2}
              hasArrow={Boolean(true)}
              id="shipping-country"
              error={formErrors.countryIso2 && lang.withRegular(formErrors.countryIso2)}
              ref={selectCountryRef}
              tabIndex={0}
            >
              {countryList.map(({ defaultName, name, iso2 }) => (
                <option
                  value={iso2}
                  className="county-item"
                  selected={iso2 === state.countryIso2}
                >
                  {defaultName || name}
                </option>
              ))}
            </Select>

            <InputText
              label={oldLang('PaymentShippingZipPlaceholder')}
              onChange={handlePostCodeChange}
              value={state.postCode}
              inputMode="text"
              tabIndex={0}
              error={formErrors.postCode && lang.withRegular(formErrors.postCode)}
            />
          </div>
        ) : undefined}
        {needName || needEmail || needPhone ? (
          <h5>{oldLang('PaymentShippingReceiver')}</h5>
        ) : undefined}
        {needName && (
          <InputText
            label={oldLang('PaymentShippingName')}
            onChange={handleFullNameChange}
            value={state.fullName}
            inputMode="text"
            tabIndex={0}
            error={formErrors.fullName && lang.withRegular(formErrors.fullName)}
          />
        )}
        {needEmail && (
          <InputText
            label={oldLang('PaymentShippingEmailPlaceholder')}
            onChange={handleEmailChange}
            value={state.email}
            inputMode="email"
            tabIndex={0}
            error={formErrors.email && lang.withRegular(formErrors.email)}
          />
        )}
        {needPhone && (
          <InputText
            label={oldLang('PaymentShippingPhoneNumber')}
            onChange={handlePhoneChange}
            value={state.phone}
            inputMode="tel"
            tabIndex={0}
            error={formErrors.phone && lang.withRegular(formErrors.phone)}
            ref={phoneRef}
          />
        )}
        <Checkbox
          label={oldLang('PaymentShippingSave')}
          subLabel={oldLang('PaymentShippingSaveInfo')}
          checked={Boolean(state.saveInfo)}
          tabIndex={0}
          onChange={handleSaveInfoChange}
        />
      </form>
    </div>
  );
};

export default memo(ShippingInfo);
