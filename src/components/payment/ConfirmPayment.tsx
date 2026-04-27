import { memo, useCallback, useEffect, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { TME_LINK_PREFIX } from '../../config';
import { isMessageFromIframe } from '../../util/browser/iframe';

import useOldLang from '../../hooks/useOldLang';

import './ConfirmPayment.scss';

export type OwnProps = {
  url: string;
  noRedirect?: boolean;
  onClose: NoneToVoidFunction;
  onPaymentFormSubmit?: (eventData: PaymentFormSubmitEvent['eventData']) => void;
};

export interface PaymentFormSubmitEvent {
  eventType: 'payment_form_submit';
  eventData: {
    credentials: {
      token: string;
      type: string;
    };
    title: string;
  };
}

interface WebAppOpenTgLinkEvent {
  eventType: 'web_app_open_tg_link';
  eventData: {
    path_full?: string;
  };
}

type IframeCallbackEvent = PaymentFormSubmitEvent | WebAppOpenTgLinkEvent;

const ConfirmPayment = ({
  url, noRedirect, onClose, onPaymentFormSubmit,
}: OwnProps) => {
  const { openTelegramLink } = getActions();

  const lang = useOldLang();
  const frameRef = useRef<HTMLIFrameElement>();

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    if (!isMessageFromIframe(event, frameRef.current)) {
      return;
    }

    try {
      const data = JSON.parse(event.data) as IframeCallbackEvent;
      const { eventType, eventData } = data;
      switch (eventType) {
        case 'web_app_open_tg_link':
          if (!noRedirect) {
            const linkUrl = TME_LINK_PREFIX + eventData.path_full!;
            openTelegramLink({ url: linkUrl });
          }
          onClose();
          break;
        case 'payment_form_submit':
          if (onPaymentFormSubmit) {
            onPaymentFormSubmit(eventData);
          }
          break;
        default:
          onClose();
          break;
      }
    } catch (err) {
      // Ignore other messages
    }
  }, [onClose, noRedirect, openTelegramLink, onPaymentFormSubmit]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <div className="ConfirmPayment">
      <iframe
        ref={frameRef}
        src={url}
        title={lang('Checkout.WebConfirmation.Title')}
        allow="payment"
        sandbox="allow-modals allow-forms allow-scripts allow-same-origin"
        className="ConfirmPayment__content"
      />
    </div>
  );
};

export default memo(ConfirmPayment);
