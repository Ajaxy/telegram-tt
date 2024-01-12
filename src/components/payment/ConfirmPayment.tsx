import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { TME_LINK_PREFIX } from '../../config';

import useLang from '../../hooks/useLang';

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

const ConfirmPayment: FC<OwnProps> = ({
  url, noRedirect, onClose, onPaymentFormSubmit,
}) => {
  const { openTelegramLink } = getActions();

  const lang = useLang();

  const handleMessage = useCallback((event: MessageEvent<string>) => {
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
        src={url}
        title={lang('Checkout.WebConfirmation.Title')}
        allow="payment"
        sandbox="allow-modals allow-forms allow-scripts allow-same-origin allow-top-navigation"
        className="ConfirmPayment__content"
      />
    </div>
  );
};

export default memo(ConfirmPayment);
