import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiCountry, ApiInvoice, ApiLabeledPrice, ApiPaymentFormRegular,
} from '../../api/types';
import type { TabState } from '../../global/types';
import type { FormState } from '../../hooks/reducers/usePaymentReducer';
import type { ShippingOption } from '../../types';
import type { PaymentFormSubmitEvent } from './ConfirmPayment';
import { PaymentStep } from '../../types';

import { getUserFullName } from '../../global/helpers';
import { selectChat, selectTabState, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { formatCurrencyAsString } from '../../util/formatCurrency';
import { detectCardTypeText } from '../common/helpers/detectCardType';

import usePaymentReducer from '../../hooks/reducers/usePaymentReducer';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';
import Checkout from './Checkout';
import ConfirmPayment from './ConfirmPayment';
import PasswordConfirm from './PasswordConfirm';
import PaymentInfo from './PaymentInfo';
import SavedPaymentCredentials from './SavedPaymentCredentials';
import Shipping from './Shipping';
import ShippingInfo from './ShippingInfo';

import './PaymentModal.scss';

const DEFAULT_PROVIDER = 'stripe';
const DONATE_PROVIDER = 'smartglocal';
const DONATE_PROVIDER_URL = 'https://payment.smart-glocal.com';
const SUPPORTED_PROVIDERS = new Set([DEFAULT_PROVIDER, DONATE_PROVIDER]);

export type OwnProps = {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  step?: PaymentStep;
  chat?: ApiChat;
  nativeProvider?: string;
  invoice?: ApiInvoice;
  form?: ApiPaymentFormRegular;
  error?: TabState['payment']['error'];
  isProviderError?: boolean;
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  confirmPaymentUrl?: string;
  countryList: ApiCountry[];
  hasShippingOptions?: boolean;
  shippingOptions?: ShippingOption[];
  requestId?: string;
  smartGlocalToken?: string;
  stripeId?: string;
  passwordValidUntil?: number;
  isExtendedMedia?: boolean;
  isPaymentFormUrl?: boolean;
  botName?: string;
};

const NETWORK_REQUEST_TIMEOUT_S = 3;

const PaymentModal: FC<OwnProps & StateProps> = ({
  isOpen,
  onClose,
  step,
  shippingOptions,
  form,
  isProviderError,
  invoice,
  nativeProvider,
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
  passwordValidUntil,
  isExtendedMedia,
  isPaymentFormUrl,
  botName,
}) => {
  const {
    loadPasswordInfo,
    validateRequestedInfo,
    sendPaymentForm,
    setPaymentStep,
    sendCredentialsInfo,
    clearPaymentError,
    validatePaymentPassword,
    setSmartGlocalCardInfo,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const [isModalOpen, openModal, closeModal] = useFlag();
  const [paymentState, paymentDispatch] = usePaymentReducer();
  const [isLoading, setIsLoading] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const prevStep = usePreviousDeprecated(step, true);
  const prevRequestId = usePreviousDeprecated(requestId);
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

  // Modal window can be closed by an event from the server side
  useEffect(() => {
    if (!isOpen && isModalOpen) {
      closeModal();
    }
  }, [closeModal, isModalOpen, isOpen]);

  useEffect(() => {
    if (step !== undefined || error) {
      setIsLoading(false);
    }
  }, [step, error, requestId]);

  // When payment verification occurs and the `step` does not change, the card details must be requested
  useEffect(() => {
    if (
      step === PaymentStep.Checkout
      && step === prevStep
      && requestId !== prevRequestId
      && !paymentState.savedCredentialId
      && !paymentState.cardNumber
    ) {
      setStep(PaymentStep.PaymentInfo);
    }
  }, [paymentState.cardNumber, paymentState.savedCredentialId, prevRequestId, prevStep, requestId, setStep, step]);

  useEffect(() => {
    if (error?.field) {
      paymentDispatch({
        type: 'setFormErrors',
        payload: {
          [error.field]: error.messageKey,
        },
      });
    }
  }, [error, paymentDispatch]);

  useEffect(() => {
    if (form?.savedInfo) {
      const {
        name: fullName, phone, email, shippingAddress,
      } = form.savedInfo;
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
  }, [form, paymentDispatch, countryList]);

  useEffect(() => {
    if (form?.savedCredentials?.length) {
      paymentDispatch({
        type: 'changeSavedCredentialId',
        payload: form.savedCredentials[0].id,
      });
    }
  }, [paymentDispatch, form?.savedCredentials]);

  const handleErrorModalClose = useCallback(() => {
    clearPaymentError();
  }, [clearPaymentError]);

  const totalPrice = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return 0;
    }

    return getTotalPrice(invoice?.prices, shippingOptions, paymentState.shipping, paymentState.tipAmount);
  }, [step, invoice?.prices, shippingOptions, paymentState.shipping, paymentState.tipAmount]);

  const checkoutInfo = useMemo(() => {
    if (step !== PaymentStep.Checkout) {
      return undefined;
    }
    return getCheckoutInfo(paymentState, shippingOptions, nativeProvider || '');
  }, [step, paymentState, shippingOptions, nativeProvider]);

  const handleNewCardClick = useCallback(() => {
    setStep(PaymentStep.PaymentInfo);
  }, [setStep]);

  const handleClearPaymentError = useCallback(() => {
    clearPaymentError();
  }, [clearPaymentError]);

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
        <h4>{error.descriptionKey ? lang.withRegular(error.descriptionKey) : lang('ErrorUnspecified')}</h4>
        <div className="dialog-buttons mt-2">
          <Button
            isText
            onClick={handleClearPaymentError}
          >
            {lang('OK')}
          </Button>
        </div>
      </Modal>
    );
  }

  const sendForm = useCallback(() => {
    sendPaymentForm({
      shippingOptionId: paymentState.shipping,
      saveCredentials: paymentState.saveCredentials,
      savedCredentialId: paymentState.savedCredentialId,
      tipAmount: paymentState.tipAmount,
    });
  }, [sendPaymentForm, paymentState]);

  const handlePaymentFormSubmit = useCallback((eventData: PaymentFormSubmitEvent['eventData']) => {
    const { credentials } = eventData;
    setSmartGlocalCardInfo(credentials);
    sendForm();
  }, [sendForm]);

  function renderModalContent(currentStep: PaymentStep, isActive?: boolean) {
    switch (currentStep) {
      case PaymentStep.Checkout:
        return (
          <Checkout
            title={form!.title}
            description={form!.description}
            photo={form!.photo}
            dispatch={paymentDispatch}
            shippingPrices={paymentState.shipping && shippingOptions
              ? getShippingPrices(shippingOptions, paymentState.shipping)
              : undefined}
            totalPrice={totalPrice}
            invoice={invoice!}
            checkoutInfo={checkoutInfo}
            isPaymentFormUrl={isPaymentFormUrl}
            hasShippingOptions={hasShippingOptions}
            tipAmount={paymentState.tipAmount}
            needAddress={Boolean(invoice?.isShippingAddressRequested)}
            savedCredentials={form!.savedCredentials}
            isTosAccepted={isTosAccepted}
            onAcceptTos={setIsTosAccepted}
            botName={botName}
          />
        );
      case PaymentStep.SavedPayments:
        return (
          <SavedPaymentCredentials
            state={paymentState}
            savedCredentials={form!.savedCredentials}
            dispatch={paymentDispatch}
            onNewCardClick={handleNewCardClick}
          />
        );
      case PaymentStep.ConfirmPassword:
        return (
          <PasswordConfirm
            state={paymentState}
            savedCredentials={form!.savedCredentials}
            onPasswordChange={setTwoFaPassword}
            isActive={currentStep === step}
          />
        );
      case PaymentStep.PaymentInfo:
        return (
          <PaymentInfo
            state={paymentState}
            dispatch={paymentDispatch}
            canSaveCredentials={Boolean(!form!.isPasswordMissing && form!.canSaveCredentials)}
            needCardholderName={needCardholderName}
            needCountry={needCountry}
            needZip={needZip}
            countryList={countryList}
            isActive={isActive}
          />
        );
      case PaymentStep.ShippingInfo:
        return (
          <ShippingInfo
            state={paymentState}
            dispatch={paymentDispatch}
            needAddress={Boolean(invoice?.isShippingAddressRequested)}
            needEmail={Boolean(invoice?.isEmailRequested || invoice?.isEmailSentToProvider)}
            needPhone={Boolean(invoice?.isPhoneRequested || invoice?.isPhoneSentToProvider)}
            needName={Boolean(invoice?.isNameRequested)}
            countryList={countryList}
          />
        );
      case PaymentStep.Shipping:
        return (
          <Shipping
            state={paymentState}
            dispatch={paymentDispatch}
            shippingOptions={shippingOptions || []}
            currency={invoice!.currency}
          />
        );
      case PaymentStep.ConfirmPayment:
        return (
          <ConfirmPayment
            url={confirmPaymentUrl!}
            noRedirect={isExtendedMedia}
            onPaymentFormSubmit={handlePaymentFormSubmit}
            onClose={closeModal}
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

  const handleButtonClick = useLastCallback(() => {
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
        if (isPaymentFormUrl) {
          setIsLoading(true);
          setStep(PaymentStep.ConfirmPayment);
          return;
        }

        if (form?.savedInfo && !requestId && !paymentState.shipping) {
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
        const shouldFillRequestedData = (invoice?.isEmailRequested && !email)
          || (invoice?.isPhoneRequested && !phone)
          || (invoice?.isNameRequested && !fullName);

        if ((invoice?.isShippingAddressRequested && !requestId) || shouldFillRequestedData) {
          setStep(PaymentStep.ShippingInfo);
          return;
        }

        if (invoice?.isShippingAddressRequested && !paymentState.shipping && shippingOptions?.length) {
          setStep(PaymentStep.Shipping);
          return;
        }

        setIsLoading(true);
        sendForm();
        break;
      }
    }
  });

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
        return oldLang('PaymentCheckout');
      case PaymentStep.ShippingInfo:
        return oldLang('PaymentShippingInfo');
      case PaymentStep.Shipping:
        return oldLang('PaymentShippingMethod');
      case PaymentStep.SavedPayments:
        return oldLang('PaymentCheckoutMethod');
      case PaymentStep.ConfirmPassword:
        return oldLang('Checkout.PasswordEntry.Title');
      case PaymentStep.PaymentInfo:
        return oldLang('PaymentCardInfo');
      case PaymentStep.ConfirmPayment:
        return oldLang('Checkout.WebConfirmation.Title');
      default:
        return '';
    }
  }, [step, oldLang]);

  const buttonText = step === PaymentStep.Checkout
    ? oldLang('Checkout.PayPrice', formatCurrencyAsString(totalPrice, invoice!.currency, oldLang.code))
    : lang('PaymentInfoDone');

  function getIsSubmitDisabled() {
    if (isLoading) {
      return true;
    }

    switch (step) {
      case PaymentStep.Checkout:
        return Boolean(invoice?.termsUrl) && !isTosAccepted;

      case PaymentStep.PaymentInfo:
        return Boolean(
          paymentState.cardNumber === ''
          || (needCardholderName && paymentState.cardholder === '')
          || paymentState.cvv === ''
          || paymentState.expiry === '',
        );

      default:
        return false;
    }
  }

  if (isProviderError) {
    return (
      <Modal
        className="error"
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={handleModalClose}
      >
        <p>
          {lang('PaymentsProvidesNotSupported', undefined, { withNodes: true, renderTextFilters: ['br'] })}
        </p>
        <div className="dialog-buttons mt-2">
          <Button
            isText
            onClick={closeModal}
          >
            {oldLang('OK')}
          </Button>
        </div>
      </Modal>
    );
  }

  const isSubmitDisabled = getIsSubmitDisabled();

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
          ariaLabel={lang('Close')}
        >
          <Icon name={step === PaymentStep.Checkout ? 'close' : 'arrow-left'} />
        </Button>
        <h3>{modalHeader}</h3>
      </div>
      {step !== undefined ? (
        <Transition
          name="slide"
          activeKey={step}
          shouldCleanup
          cleanupOnlyKey={PaymentStep.ConfirmPayment}
        >
          {(isActive) => (
            <div className="content custom-scroll">
              {renderModalContent(step, isActive)}
            </div>
          )}
        </Transition>
      ) : (
        <div className="empty-content">
          <Spinner color="gray" />
        </div>
      )}
      {canRenderFooter && (
        <div className="footer">
          <Button
            className="button-text"
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
  (global): Complete<StateProps> => {
    const {
      form,
      step,
      shippingOptions,
      error,
      confirmPaymentUrl,
      inputInvoice,
      requestId,
      stripeCredentials,
      smartGlocalCredentials,
      temporaryPassword,
      isExtendedMedia,
      url,
    } = selectTabState(global).payment;

    const { invoice, nativeParams, nativeProvider } = form || {};
    const countryList = global.countryList.general;

    let providerName = form?.nativeProvider;
    if (!providerName && url) {
      providerName = url.startsWith(DONATE_PROVIDER_URL) ? DONATE_PROVIDER : undefined;
    }

    const chat = inputInvoice && 'chatId' in inputInvoice ? selectChat(global, inputInvoice.chatId) : undefined;
    const isProviderError = Boolean(invoice && (!providerName || !SUPPORTED_PROVIDERS.has(providerName)));
    const { needCardholderName, needCountry, needZip } = (nativeParams || {});
    const bot = form?.botId ? selectUser(global, form.botId) : undefined;
    const botName = getUserFullName(bot);

    return {
      step,
      chat,
      shippingOptions,
      nativeProvider: providerName,
      isProviderError,
      form,
      invoice,
      needCardholderName,
      needCountry,
      needZip,
      error,
      confirmPaymentUrl: confirmPaymentUrl ?? url,
      isPaymentFormUrl: Boolean(!nativeProvider && url),
      countryList,
      requestId,
      hasShippingOptions: Boolean(shippingOptions?.length),
      smartGlocalToken: smartGlocalCredentials?.token,
      stripeId: stripeCredentials?.id,
      passwordValidUntil: temporaryPassword?.validUntil,
      isExtendedMedia,
      botName,
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
  prices: ApiLabeledPrice[] = [],
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

export type ApiCredentials = {
  data: {
    cardNumber: string;
    cardholder: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    country: string;
    zip: string;
  };
};

function getCredentials(paymentState: FormState): ApiCredentials {
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
