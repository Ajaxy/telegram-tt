import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../global/types';
import { PaymentStep, ShippingOption, Price } from '../../types';
import { ApiError } from '../../api/types';

import { pick } from '../../util/iteratees';
import { getCurrencySign } from '../middle/helpers/getCurrencySign';
import { detectCardTypeText } from '../common/helpers/detectCardType';
import { getShippingError } from '../../modules/helpers/payments';
import usePaymentReducer, { FormState } from '../../hooks/reducers/usePaymentReducer';
import useLang from '../../hooks/useLang';

import ShippingInfo from './ShippingInfo';
import Shipping from './Shipping';
import Checkout from './Checkout';
import PaymentInfo from './PaymentInfo';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import Spinner from '../ui/Spinner';

import './PaymentModal.scss';

const DEFAULT_PROVIDER = 'stripe';

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
};

type StateProps = {
  nameRequested?: boolean;
  shippingAddressRequested?: boolean;
  phoneRequested?: boolean;
  emailRequested?: boolean;
  flexible?: boolean;
  phoneToProvider?: boolean;
  emailToProvider?: boolean;
  currency?: string;
  prices?: Price[];
  isProviderError: boolean;
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  globalErrors?: ApiError[];
};

type GlobalStateProps = Pick<GlobalState['payment'], 'step' | 'shippingOptions' |
'savedInfo' | 'canSaveCredentials' | 'nativeProvider' | 'passwordMissing' | 'invoiceContent' |
'error'>;

type DispatchProps = Pick<GlobalActions, 'validateRequestedInfo' | 'sendPaymentForm' | 'setPaymentStep'
| 'sendCredentialsInfo' | 'clearPaymentError' >;

const Invoice: FC<OwnProps & StateProps & GlobalStateProps & DispatchProps> = ({
  isOpen,
  onClose,
  step,
  shippingOptions,
  savedInfo,
  canSaveCredentials,
  nameRequested,
  shippingAddressRequested,
  phoneRequested,
  emailRequested,
  phoneToProvider,
  emailToProvider,
  currency,
  passwordMissing,
  isProviderError,
  invoiceContent,
  nativeProvider,
  prices,
  needCardholderName,
  needCountry,
  needZip,
  error,
  globalErrors,
  validateRequestedInfo,
  sendPaymentForm,
  setPaymentStep,
  sendCredentialsInfo,
  clearPaymentError,
}) => {
  const [paymentState, paymentDispatch] = usePaymentReducer();
  const currencySign = getCurrencySign(currency);
  const [isLoading, setIsLoading] = useState(false);
  const lang = useLang();

  useEffect(() => {
    if (step || error || globalErrors) {
      setIsLoading(false);
    }
  }, [step, error, globalErrors]);

  useEffect(() => {
    if (error && error.field) {
      paymentDispatch({
        type: 'setFormErrors',
        payload: {
          [error.field]: error.fieldError,
        },
      });
      return;
    }
    if (globalErrors && globalErrors.length) {
      const errors = getShippingError(globalErrors);
      paymentDispatch({
        type: 'setFormErrors',
        payload: {
          ...errors,
        },
      });
    }
  }, [error, globalErrors, paymentDispatch]);

  useEffect(() => {
    if (savedInfo) {
      const {
        name: fullName, phone, email, shippingAddress,
      } = savedInfo;
      paymentDispatch({
        type: 'updateUserInfo',
        payload: {
          fullName,
          phone: phone && phone.charAt(0) !== '+'
            ? `+${phone}`
            : phone,
          email,
          ...(shippingAddress || {}),
        },
      });
    }
  }, [savedInfo, paymentDispatch]);

  const handleErrorModalClose = useCallback(() => {
    clearPaymentError();
  }, [clearPaymentError]);

  const totalPrice = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return 0;
    }

    return getTotalPrice(prices, shippingOptions, paymentState.shipping);
  }, [step, paymentState.shipping, prices, shippingOptions]);

  const checkoutInfo = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return undefined;
    }
    return getCheckoutInfo(paymentState, shippingOptions, nativeProvider || '');
  }, [step, paymentState, shippingOptions, nativeProvider]);

  function renderError() {
    if (!error) {
      return undefined;
    }
    return (
      <Modal
        className="error"
        isOpen={Boolean(error)}
        onClose={handleErrorModalClose}
      >
        <h4>{error.description || 'Error'}</h4>
        {error.description || 'Error'}
        <Button
          isText
          onClick={clearPaymentError}
        >
          OK
        </Button>
      </Modal>
    );
  }

  function renderModalContent(cuurentStep: PaymentStep) {
    switch (cuurentStep) {
      case PaymentStep.ShippingInfo:
        return (
          <ShippingInfo
            state={paymentState}
            dispatch={paymentDispatch}
            needAddress={Boolean(shippingAddressRequested)}
            needEmail={Boolean(emailRequested || emailToProvider)}
            needPhone={Boolean(phoneRequested || phoneToProvider)}
            needName={Boolean(nameRequested)}
          />
        );
      case PaymentStep.Shipping:
        return (
          <Shipping
            state={paymentState}
            dispatch={paymentDispatch}
            shippingOptions={shippingOptions || []}
            currency={currencySign}
          />
        );
      case PaymentStep.PaymentInfo:
        return (
          <PaymentInfo
            state={paymentState}
            dispatch={paymentDispatch}
            canSaveCredentials={Boolean(!passwordMissing && canSaveCredentials)}
            needCardholderName={needCardholderName}
            needCountry={needCountry}
            needZip={needZip}
          />
        );
      case PaymentStep.Checkout:
        return (
          <Checkout
            prices={prices}
            shippingPrices={paymentState.shipping && shippingOptions
              ? getShippingPrices(shippingOptions, paymentState.shipping)
              : undefined}
            totalPrice={totalPrice}
            invoiceContent={invoiceContent}
            checkoutInfo={checkoutInfo}
            currency={currencySign}
          />
        );
      default:
        return undefined;
    }
  }

  const validateRequest = useCallback(() => {
    const { saveInfo } = paymentState;
    const requestInfo = getRequestInfo(paymentState);
    validateRequestedInfo({ requestInfo, saveInfo });
  }, [validateRequestedInfo, paymentState]);

  const sendCredentials = useCallback(() => {
    const credentials = getCredentials(paymentState);
    sendCredentialsInfo({
      credentials,
    });
  }, [sendCredentialsInfo, paymentState]);

  const sendForm = useCallback(() => {
    sendPaymentForm({
      shippingOptionId: paymentState.shipping,
      saveCredentials: paymentState.saveCredentials,
    });
  }, [sendPaymentForm, paymentState]);

  const setStep = useCallback((nextStep) => {
    setPaymentStep({ step: nextStep });
  }, [setPaymentStep]);

  const handleButtonClick = useCallback(() => {
    setIsLoading(true);
    switch (step) {
      case PaymentStep.ShippingInfo:
        return validateRequest();
      case PaymentStep.Shipping:
        return setStep(PaymentStep.PaymentInfo);
      case PaymentStep.PaymentInfo:
        return sendCredentials();
      case PaymentStep.Checkout:
        return sendForm();
      default:
        return () => {};
    }
  }, [step, validateRequest, setStep, sendCredentials, sendForm]);

  const modalHeader = useMemo(() => {
    switch (step) {
      case PaymentStep.ShippingInfo:
        return lang('PaymentShippingInfo');
      case PaymentStep.Shipping:
        return lang('PaymentShippingMethod');
      case PaymentStep.PaymentInfo:
        return lang('PaymentCardInfo');
      case PaymentStep.Checkout:
        return lang('PaymentCheckout');
      default:
        return '';
    }
  }, [step, lang]);

  const buttonText = useMemo(() => {
    switch (step) {
      case PaymentStep.Checkout:
        return `Pay ${currencySign}${(totalPrice / 100).toFixed(2)}`;
      default:
        return 'Next Step';
    }
  }, [step, totalPrice, currencySign]);

  if (isProviderError) {
    return (
      <Modal
        className="error"
        isOpen={isOpen}
        onClose={onClose}
      >
        Sorry, Telegram T doesn&apos;t support payments with this provider yet.
         Please use one of our mobile apps to do this.
        <Button
          isText
          onClick={onClose}
        >
          OK
        </Button>
      </Modal>
    );
  }

  return (
    <Modal
      className="PaymentModal"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="header">
        <Button
          className="close-button"
          color="translucent"
          round
          size="smaller"
          onClick={onClose}
          ariaLabel="Close"
        >
          <i className="icon-close" />
        </Button>
        <h3>{ modalHeader }</h3>
      </div>
      {step !== undefined ? (
        <Transition name="slide" activeKey={step}>
          {() => (
            <div className="content custom-scroll">
              {renderModalContent(step)}
            </div>
          )}
        </Transition>
      ) : (
        <div className="empty-content">
          <Spinner color="gray" />
        </div>
      )}
      <div className="footer">
        <Button
          type="submit"
          onClick={handleButtonClick}
          disabled={isLoading}
          isLoading={isLoading}
        >
          {buttonText}
        </Button>
      </div>
      {error && !error.field && renderError()}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps & GlobalStateProps => {
    const {
      step,
      shippingOptions,
      savedInfo,
      canSaveCredentials,
      invoice,
      invoiceContent,
      nativeProvider,
      nativeParams,
      passwordMissing,
      error,
    } = global.payment;

    const isProviderError = Boolean(invoice && (!nativeProvider || nativeProvider !== DEFAULT_PROVIDER));
    const { needCardholderName, needCountry, needZip } = (nativeParams || {});
    const {
      nameRequested,
      phoneRequested,
      emailRequested,
      shippingAddressRequested,
      flexible,
      phoneToProvider,
      emailToProvider,
      currency,
      prices,
    } = (invoice || {});

    return {
      step,
      shippingOptions,
      savedInfo,
      canSaveCredentials,
      nativeProvider,
      passwordMissing,
      nameRequested,
      shippingAddressRequested,
      phoneRequested,
      emailRequested,
      flexible,
      phoneToProvider,
      emailToProvider,
      currency,
      prices,
      isProviderError,
      invoiceContent,
      needCardholderName,
      needCountry,
      needZip,
      error,
      globalErrors: global.errors,
    };
  },
  (setGlobal, actions): DispatchProps => {
    return pick(actions, [
      'validateRequestedInfo',
      'sendPaymentForm',
      'setPaymentStep',
      'sendCredentialsInfo',
      'clearPaymentError',
    ]);
  },
)(Invoice));

function findShippingOption(shippingOptions: ShippingOption[], optionId: string) {
  return shippingOptions.find(({ id }) => id === optionId);
}

function getShippingPrices(shippingOptions: ShippingOption[], shippingOption: string) {
  const option = findShippingOption(shippingOptions, shippingOption);
  return option ? option.prices : undefined;
}

function getTotalPrice(prices: Price[] = [], shippingOptions: ShippingOption[] | undefined, shippingOption: string) {
  const shippingPrices = shippingOptions
    ? getShippingPrices(shippingOptions, shippingOption)
    : [];
  let total = 0;
  const totalPrices = prices.concat(shippingPrices || []);
  total = totalPrices.reduce((acc, cur) => {
    return acc + cur.amount;
  }, total);
  return total;
}

function getCheckoutInfo(state: FormState, shippingOptions: ShippingOption[] | undefined, paymentProvider: string) {
  const cardTypeText = detectCardTypeText(state.cardNumber);
  const paymentMethod = `${cardTypeText} *${state.cardNumber.slice(-4)}`;
  const shippingAddress = state.streetLine1
    ? `${state.streetLine1}, ${state.city}, ${state.countryIso2}`
    : undefined;
  const { phone, fullName: name } = state;
  const shippingOption = shippingOptions ? findShippingOption(shippingOptions, state.shipping) : undefined;
  const shippingMethod = shippingOption ? shippingOption.title : undefined;
  return {
    paymentMethod,
    paymentProvider,
    shippingAddress,
    name,
    phone,
    shippingMethod,
  };
}

function getRequestInfo(paymentState: FormState) {
  const {
    streetLine1,
    streetLine2,
    city,
    state,
    countryIso2,
    postCode,
    fullName: name,
    phone,
    email,
  } = paymentState;

  const shippingAddress = {
    streetLine1,
    streetLine2,
    city,
    state,
    countryIso2,
    postCode,
  };

  return {
    name,
    phone,
    email,
    shippingAddress,
  };
}

function getCredentials(paymentState: FormState) {
  const {
    cardNumber, cardholder, expiry, cvv, billingCountry, billingZip,
  } = paymentState;
  const [expiryMonth, expiryYear] = expiry.split('/');
  const data = {
    cardNumber,
    cardholder,
    expiryMonth,
    expiryYear,
    cvv,
    country: billingCountry,
    zip: billingZip,
  };

  return {
    data,
  };
}
