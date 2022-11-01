import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { ApiChat, ApiCountry, ApiPaymentCredentials } from '../../api/types';
import type { Price, ShippingOption } from '../../types';
import type { FormState } from '../../hooks/reducers/usePaymentReducer';

import { PaymentStep } from '../../types';
import { selectChat } from '../../global/selectors';
import { formatCurrency } from '../../util/formatCurrency';
import buildClassName from '../../util/buildClassName';
import { detectCardTypeText } from '../common/helpers/detectCardType';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import usePaymentReducer from '../../hooks/reducers/usePaymentReducer';

import ShippingInfo from './ShippingInfo';
import Shipping from './Shipping';
import Checkout from './Checkout';
import PaymentInfo from './PaymentInfo';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import Spinner from '../ui/Spinner';
import ConfirmPayment from './ConfirmPayment';
import SavedPaymentCredentials from './SavedPaymentCredentials';
import PasswordConfirm from './PasswordConfirm';

import './PaymentModal.scss';

const DEFAULT_PROVIDER = 'stripe';
const DONATE_PROVIDER = 'smartglocal';
const SUPPORTED_PROVIDERS = new Set([DEFAULT_PROVIDER, DONATE_PROVIDER]);

export type OwnProps = {
  isOpen?: boolean;
  onClose: () => void;
};

type StateProps = {
  chat?: ApiChat;
  isNameRequested?: boolean;
  isShippingAddressRequested?: boolean;
  isPhoneRequested?: boolean;
  isEmailRequested?: boolean;
  shouldSendPhoneToProvider?: boolean;
  shouldSendEmailToProvider?: boolean;
  currency?: string;
  prices?: Price[];
  isProviderError: boolean;
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  confirmPaymentUrl?: string;
  countryList: ApiCountry[];
  hasShippingOptions: boolean;
  requestId?: string;
  smartGlocalToken?: string;
  stripeId?: string;
  savedCredentials?: ApiPaymentCredentials[];
  passwordValidUntil?: number;
};

type GlobalStateProps = Pick<GlobalState['payment'], (
  'step' | 'shippingOptions' |
  'savedInfo' | 'canSaveCredentials' | 'nativeProvider' | 'passwordMissing' | 'invoice' | 'error'
)>;

const NETWORK_REQUEST_TIMEOUT_S = 3;

const PaymentModal: FC<OwnProps & StateProps & GlobalStateProps> = ({
  isOpen,
  onClose,
  step,
  chat,
  shippingOptions,
  savedInfo,
  canSaveCredentials,
  isNameRequested,
  isShippingAddressRequested,
  isPhoneRequested,
  isEmailRequested,
  shouldSendPhoneToProvider,
  shouldSendEmailToProvider,
  currency,
  passwordMissing,
  isProviderError,
  invoice,
  nativeProvider,
  prices,
  needCardholderName,
  needCountry,
  needZip,
  confirmPaymentUrl,
  error,
  countryList,
  hasShippingOptions,
  requestId,
  smartGlocalToken,
  stripeId,
  savedCredentials,
  passwordValidUntil,
}) => {
  const {
    loadPasswordInfo,
    validateRequestedInfo,
    sendPaymentForm,
    setPaymentStep,
    sendCredentialsInfo,
    clearPaymentError,
    validatePaymentPassword,
  } = getActions();

  const lang = useLang();

  const [isModalOpen, openModal, closeModal] = useFlag();
  const [paymentState, paymentDispatch] = usePaymentReducer();
  const [isLoading, setIsLoading] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [twoFaPassword, setTwoFaPassword] = useState('');

  const canRenderFooter = step !== PaymentStep.ConfirmPayment;

  const setStep = useCallback((nextStep) => {
    setPaymentStep({ step: nextStep });
  }, [setPaymentStep]);

  useEffect(() => {
    if (isOpen) {
      setTwoFaPassword('');
      loadPasswordInfo();
      openModal();
    }
  }, [isOpen, loadPasswordInfo, openModal]);

  useEffect(() => {
    if (step !== undefined || error) {
      setIsLoading(false);
    }
  }, [step, error]);

  useEffect(() => {
    if (error?.field) {
      paymentDispatch({
        type: 'setFormErrors',
        payload: {
          [error.field]: error.message,
        },
      });
    }
  }, [error, paymentDispatch]);

  useEffect(() => {
    if (savedInfo) {
      const {
        name: fullName, phone, email, shippingAddress,
      } = savedInfo;
      const {
        countryIso2, ...shippingAddressRest
      } = shippingAddress || {};
      const shippingCountry = countryIso2 && countryList.find(({ iso2 }) => iso2 === countryIso2)!.defaultName;
      paymentDispatch({
        type: 'updateUserInfo',
        payload: {
          fullName,
          phone: phone && phone.charAt(0) !== '+'
            ? `+${phone}`
            : phone,
          email,
          ...(shippingCountry && {
            country: shippingCountry,
            countryIso2,
            ...shippingAddressRest,
          }),
        },
      });
    }
  }, [savedInfo, paymentDispatch, countryList]);

  useEffect(() => {
    if (savedCredentials?.length) {
      paymentDispatch({
        type: 'changeSavedCredentialId',
        payload: savedCredentials[0].id,
      });
    }
  }, [paymentDispatch, savedCredentials]);

  const handleErrorModalClose = useCallback(() => {
    clearPaymentError();
  }, [clearPaymentError]);

  const totalPrice = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return 0;
    }

    return getTotalPrice(prices, shippingOptions, paymentState.shipping, paymentState.tipAmount);
  }, [step, prices, shippingOptions, paymentState.shipping, paymentState.tipAmount]);

  const checkoutInfo = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return undefined;
    }
    return getCheckoutInfo(paymentState, shippingOptions, nativeProvider || '');
  }, [step, paymentState, shippingOptions, nativeProvider]);

  const handleNewCardClick = useCallback(() => {
    setStep(PaymentStep.PaymentInfo);
  }, [setStep]);

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
        <p>{error.description || 'Error'}</p>
        <Button
          isText
          onClick={clearPaymentError}
        >
          {lang('OK')}
        </Button>
      </Modal>
    );
  }

  function renderModalContent(currentStep: PaymentStep) {
    switch (currentStep) {
      case PaymentStep.Checkout:
        return (
          <Checkout
            chat={chat}
            prices={prices}
            dispatch={paymentDispatch}
            shippingPrices={paymentState.shipping && shippingOptions
              ? getShippingPrices(shippingOptions, paymentState.shipping)
              : undefined}
            totalPrice={totalPrice}
            invoice={invoice}
            checkoutInfo={checkoutInfo}
            currency={currency!}
            hasShippingOptions={hasShippingOptions}
            tipAmount={paymentState.tipAmount}
            needAddress={Boolean(isShippingAddressRequested)}
            savedCredentials={savedCredentials}
            isTosAccepted={isTosAccepted}
            onAcceptTos={setIsTosAccepted}
          />
        );
      case PaymentStep.SavedPayments:
        return (
          <SavedPaymentCredentials
            state={paymentState}
            savedCredentials={savedCredentials}
            dispatch={paymentDispatch}
            onNewCardClick={handleNewCardClick}
          />
        );
      case PaymentStep.ConfirmPassword:
        return (
          <PasswordConfirm
            state={paymentState}
            savedCredentials={savedCredentials}
            onPasswordChange={setTwoFaPassword}
            isActive={currentStep === step}
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
            countryList={countryList}
          />
        );
      case PaymentStep.ShippingInfo:
        return (
          <ShippingInfo
            state={paymentState}
            dispatch={paymentDispatch}
            needAddress={Boolean(isShippingAddressRequested)}
            needEmail={Boolean(isEmailRequested || shouldSendEmailToProvider)}
            needPhone={Boolean(isPhoneRequested || shouldSendPhoneToProvider)}
            needName={Boolean(isNameRequested)}
            countryList={countryList}
          />
        );
      case PaymentStep.Shipping:
        return (
          <Shipping
            state={paymentState}
            dispatch={paymentDispatch}
            shippingOptions={shippingOptions || []}
            currency={currency!}
          />
        );
      case PaymentStep.ConfirmPayment:
        return (
          <ConfirmPayment
            url={confirmPaymentUrl!}
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
      savedCredentialId: paymentState.savedCredentialId,
      tipAmount: paymentState.tipAmount,
    });
  }, [sendPaymentForm, paymentState]);

  const handleButtonClick = useCallback(() => {
    switch (step) {
      case PaymentStep.ShippingInfo:
        setIsLoading(true);
        validateRequest();
        break;

      case PaymentStep.Shipping:
        setStep(PaymentStep.Checkout);
        break;

      case PaymentStep.SavedPayments:
        setStep(PaymentStep.ConfirmPassword);
        break;

      case PaymentStep.ConfirmPassword:
        if (twoFaPassword === '') {
          return;
        }

        setIsLoading(true);
        validatePaymentPassword({ password: twoFaPassword });
        break;

      case PaymentStep.PaymentInfo:
        setIsLoading(true);
        sendCredentials();
        paymentDispatch({ type: 'changeSavedCredentialId', payload: '' });
        break;

      case PaymentStep.Checkout: {
        if (savedInfo && !requestId && !paymentState.shipping) {
          setIsLoading(true);
          validateRequest();
          return;
        }

        if (
          paymentState.savedCredentialId
          && (!passwordValidUntil || passwordValidUntil <= (Date.now() / 1000 - NETWORK_REQUEST_TIMEOUT_S))
        ) {
          setStep(PaymentStep.ConfirmPassword);
          return;
        }

        if (
          !paymentState.savedCredentialId
          && (
            (nativeProvider === DEFAULT_PROVIDER && !stripeId)
            || (nativeProvider === DONATE_PROVIDER && !smartGlocalToken)
          )
        ) {
          setStep(PaymentStep.PaymentInfo);
          return;
        }

        const { phone, email, fullName } = paymentState;
        const shouldFillRequestedData = (isEmailRequested && !email)
          || (isPhoneRequested && !phone)
          || (isNameRequested && !fullName);

        if ((isShippingAddressRequested && !requestId) || shouldFillRequestedData) {
          setStep(PaymentStep.ShippingInfo);
          return;
        }

        if (isShippingAddressRequested && !paymentState.shipping) {
          setStep(PaymentStep.Shipping);
          return;
        }

        setIsLoading(true);
        sendForm();
        break;
      }
    }
  }, [
    isEmailRequested, isNameRequested, isPhoneRequested, isShippingAddressRequested, nativeProvider, passwordValidUntil,
    paymentDispatch, paymentState, requestId, savedInfo, sendCredentials, sendForm, setStep, smartGlocalToken, step,
    stripeId, twoFaPassword, validatePaymentPassword, validateRequest,
  ]);

  useEffect(() => {
    return step === PaymentStep.ConfirmPassword
      ? captureKeyboardListeners({ onEnter: handleButtonClick })
      : undefined;
  },
  [handleButtonClick, step]);

  const handleModalClose = useCallback(() => {
    paymentDispatch({
      type: 'resetState',
    });
    setIsTosAccepted(false);
    onClose();
  }, [onClose, paymentDispatch]);

  const handleBackClick = useCallback(() => {
    setStep(step === PaymentStep.ConfirmPassword ? PaymentStep.SavedPayments : PaymentStep.Checkout);
  }, [setStep, step]);

  const modalHeader = useMemo(() => {
    switch (step) {
      case PaymentStep.Checkout:
        return lang('PaymentCheckout');
      case PaymentStep.ShippingInfo:
        return lang('PaymentShippingInfo');
      case PaymentStep.Shipping:
        return lang('PaymentShippingMethod');
      case PaymentStep.SavedPayments:
        return lang('PaymentCheckoutMethod');
      case PaymentStep.ConfirmPassword:
        return lang('Checkout.PasswordEntry.Title');
      case PaymentStep.PaymentInfo:
        return lang('PaymentCardInfo');
      case PaymentStep.ConfirmPayment:
        return lang('Checkout.WebConfirmation.Title');
      default:
        return '';
    }
  }, [step, lang]);

  const buttonText = step === PaymentStep.Checkout
    ? lang('Checkout.PayPrice', formatCurrency(totalPrice, currency!, lang.code))
    : lang('Next');

  const isSubmitDisabled = isLoading
    || Boolean(step === PaymentStep.Checkout && invoice?.isRecurring && !isTosAccepted);

  if (isProviderError) {
    return (
      <Modal
        className="error"
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={handleModalClose}
      >
        <p>
          Sorry, Telegram WebZ doesn&apos;t support payments with this provider yet. <br />
          Please use one of our mobile apps to do this.
        </p>
        <Button
          isText
          onClick={closeModal}
        >
          {lang('OK')}
        </Button>
      </Modal>
    );
  }

  return (
    <Modal
      className={buildClassName('PaymentModal', invoice?.isRecurring && 'recurring')}
      isOpen={isModalOpen}
      onClose={closeModal}
      onCloseAnimationEnd={handleModalClose}
    >
      <div className="header" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          className="close-button"
          color="translucent"
          round
          size="smaller"
          onClick={step === PaymentStep.Checkout ? closeModal : handleBackClick}
          ariaLabel="Close"
        >
          <i className={step === PaymentStep.Checkout ? 'icon-close' : 'icon-arrow-left'} />
        </Button>
        <h3>{modalHeader}</h3>
      </div>
      {step !== undefined ? (
        <Transition name="slide" activeKey={step}>
          <div className="content custom-scroll">
            {renderModalContent(step)}
          </div>
        </Transition>
      ) : (
        <div className="empty-content">
          <Spinner color="gray" />
        </div>
      )}
      {canRenderFooter && (
        <div className="footer">
          <Button
            type="submit"
            onClick={handleButtonClick}
            disabled={isSubmitDisabled}
            isLoading={isLoading}
          >
            {buttonText}
          </Button>
        </div>
      )}
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
      invoiceContainer,
      nativeProvider,
      nativeParams,
      passwordMissing,
      error,
      confirmPaymentUrl,
      inputInvoice,
      requestId,
      stripeCredentials,
      smartGlocalCredentials,
      savedCredentials,
      temporaryPassword,
    } = global.payment;

    const chat = inputInvoice && 'chatId' in inputInvoice ? selectChat(global, inputInvoice.chatId) : undefined;
    const isProviderError = Boolean(invoice && (!nativeProvider || !SUPPORTED_PROVIDERS.has(nativeProvider)));
    const { needCardholderName, needCountry, needZip } = (nativeParams || {});
    const {
      isNameRequested,
      isShippingAddressRequested,
      isPhoneRequested,
      isEmailRequested,
      shouldSendPhoneToProvider,
      shouldSendEmailToProvider,
      currency,
      prices,
    } = (invoiceContainer || {});

    return {
      step,
      chat,
      shippingOptions,
      savedInfo,
      canSaveCredentials,
      nativeProvider,
      passwordMissing,
      isNameRequested,
      isShippingAddressRequested,
      isPhoneRequested,
      isEmailRequested,
      shouldSendPhoneToProvider,
      shouldSendEmailToProvider,
      currency,
      prices,
      isProviderError,
      invoice,
      needCardholderName,
      needCountry,
      needZip,
      error,
      confirmPaymentUrl,
      countryList: global.countryList.general,
      requestId,
      hasShippingOptions: Boolean(shippingOptions?.length),
      smartGlocalToken: smartGlocalCredentials?.token,
      stripeId: stripeCredentials?.id,
      savedCredentials,
      passwordValidUntil: temporaryPassword?.validUntil,
    };
  },
)(PaymentModal));

function findShippingOption(shippingOptions: ShippingOption[], optionId: string) {
  return shippingOptions.find(({ id }) => id === optionId);
}

function getShippingPrices(shippingOptions: ShippingOption[], shippingOption: string) {
  const option = findShippingOption(shippingOptions, shippingOption);
  return option?.prices;
}

function getTotalPrice(
  prices: Price[] = [],
  shippingOptions: ShippingOption[] | undefined,
  shippingOption: string,
  tipAmount: number,
) {
  const shippingPrices = shippingOptions
    ? getShippingPrices(shippingOptions, shippingOption)
    : [];
  let total = tipAmount;
  const totalPrices = prices.concat(shippingPrices || []);
  total = totalPrices.reduce((acc, cur) => {
    return acc + cur.amount;
  }, total);
  return total;
}

function getCheckoutInfo(state: FormState, shippingOptions: ShippingOption[] | undefined, paymentProvider: string) {
  const cardTypeText = detectCardTypeText(state.cardNumber);
  const paymentMethod = cardTypeText && state.cardNumber ? `${cardTypeText} *${state.cardNumber.slice(-4)}` : undefined;
  const shippingAddress = state.streetLine1
    ? `${state.streetLine1}, ${state.city}, ${state.countryIso2}`
    : undefined;
  const { phone, fullName: name } = state;
  const shippingOption = shippingOptions ? findShippingOption(shippingOptions, state.shipping) : undefined;
  const shippingMethod = shippingOption?.title;
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
