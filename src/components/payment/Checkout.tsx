import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiInvoice, ApiPaymentCredentials,
} from '../../api/types';
import type { FormEditDispatch } from '../../hooks/reducers/usePaymentReducer';
import type { LangCode, Price } from '../../types';
import type { IconName } from '../../types/icons';
import { PaymentStep } from '../../types';

import { getWebDocumentHash } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatCurrency';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';

import SafeLink from '../common/SafeLink';
import Checkbox from '../ui/Checkbox';
import ListItem from '../ui/ListItem';
import Skeleton from '../ui/placeholder/Skeleton';

import styles from './Checkout.module.scss';

export type OwnProps = {
  invoice?: ApiInvoice;
  checkoutInfo?: {
    paymentMethod?: string;
    paymentProvider?: string;
    shippingAddress?: string;
    name?: string;
    phone?: string;
    shippingMethod?: string;
    botName?: string;
  };
  prices?: Price[];
  totalPrice?: number;
  needAddress?: boolean;
  hasShippingOptions?: boolean;
  tipAmount?: number;
  shippingPrices?: Price[];
  currency: string;
  isTosAccepted?: boolean;
  dispatch?: FormEditDispatch;
  onAcceptTos?: (isAccepted: boolean) => void;
  savedCredentials?: ApiPaymentCredentials[];
  isPaymentFormUrl?: boolean;
  botName?: string;
};

const Checkout: FC<OwnProps> = ({
  invoice,
  prices,
  shippingPrices,
  checkoutInfo,
  currency,
  totalPrice,
  isTosAccepted,
  dispatch,
  onAcceptTos,
  tipAmount,
  needAddress,
  hasShippingOptions,
  savedCredentials,
  isPaymentFormUrl,
  botName,
}) => {
  const { setPaymentStep } = getActions();

  const lang = useLang();
  const isInteractive = Boolean(dispatch);

  const {
    photo, title, text, termsUrl, suggestedTipAmounts, maxTipAmount,
  } = invoice || {};
  const {
    paymentMethod,
    paymentProvider,
    shippingAddress,
    name,
    phone,
    shippingMethod,
  } = (checkoutInfo || {});

  const photoUrl = useMedia(getWebDocumentHash(photo));

  const handleTipsClick = useCallback((tips: number) => {
    dispatch!({ type: 'setTipAmount', payload: maxTipAmount ? Math.min(tips, maxTipAmount) : tips });
  }, [dispatch, maxTipAmount]);

  const handlePaymentMethodClick = useCallback(() => {
    setPaymentStep({ step: savedCredentials?.length ? PaymentStep.SavedPayments : PaymentStep.PaymentInfo });
  }, [savedCredentials?.length, setPaymentStep]);

  const handleShippingAddressClick = useCallback(() => {
    setPaymentStep({ step: PaymentStep.ShippingInfo });
  }, [setPaymentStep]);

  const handleShippingMethodClick = useCallback(() => {
    setPaymentStep({ step: PaymentStep.Shipping });
  }, [setPaymentStep]);

  function renderTips() {
    return (
      <>
        <div className={styles.priceInfoItem}>
          <div className={styles.priceInfoItemTitle}>
            {title}
          </div>
          <div>
            {formatCurrency(tipAmount!, currency, lang.code)}
          </div>
        </div>
        <div className={styles.tipsList}>
          {suggestedTipAmounts!.map((tip) => (
            <div
              key={tip}
              className={buildClassName(styles.tipsItem, tip === tipAmount && styles.tipsItem_active)}
              onClick={dispatch ? () => handleTipsClick(tip === tipAmount ? 0 : tip) : undefined}
            >
              {formatCurrency(tip, currency, lang.code, true)}
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderTosLink(url: string, isRtl?: boolean) {
    const langString = lang('PaymentCheckoutAcceptRecurrent', botName);
    const langStringSplit = langString.split('*');
    return (
      <>
        {langStringSplit[0]}
        <SafeLink
          url={url}
          text={langStringSplit[1]}
          isRtl={isRtl}
        />
        {langStringSplit.slice(2)}
      </>
    );
  }

  function renderTos(url: string) {
    return (
      <Checkbox
        label={renderTosLink(url, lang.isRtl)}
        name="checkout_tos"
        checked={Boolean(isTosAccepted)}
        className={styles.tosCheckbox}
        tabIndex={0}
        onCheck={onAcceptTos}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.description}>
        {photoUrl && <img className={styles.checkoutPicture} src={photoUrl} draggable={false} alt="" />}
        {!photoUrl && photo && (
          <Skeleton
            width={photo.dimensions?.width}
            height={photo.dimensions?.height}
            className={styles.checkoutPicture}
            forceAspectRatio
          />
        )}
        <div className={styles.text}>
          <h5 className={styles.checkoutTitle}>{title}</h5>
          {text && <div className={styles.checkoutDescription}>{renderText(text, ['br', 'links', 'emoji'])}</div>}
        </div>
      </div>
      <div className={styles.priceInfo}>
        {prices && prices.map((item) => (
          renderPaymentItem(lang.code, item.label, item.amount, currency)
        ))}
        {shippingPrices && shippingPrices.map((item) => (
          renderPaymentItem(lang.code, item.label, item.amount, currency)
        ))}
        {suggestedTipAmounts && suggestedTipAmounts.length > 0 && renderTips()}
        {totalPrice !== undefined && (
          renderPaymentItem(lang.code, lang('Checkout.TotalAmount'), totalPrice, currency, true)
        )}
      </div>
      <div className={styles.invoiceInfo}>
        {!isPaymentFormUrl && renderCheckoutItem({
          title: paymentMethod || savedCredentials?.[0].title,
          label: lang('PaymentCheckoutMethod'),
          icon: 'card',
          onClick: isInteractive ? handlePaymentMethodClick : undefined,
        })}
        {paymentProvider && renderCheckoutItem({
          title: paymentProvider,
          label: lang('PaymentCheckoutProvider'),
          customIcon: buildClassName(styles.provider, styles[paymentProvider.toLowerCase()]),
        })}
        {(needAddress || !isInteractive) && renderCheckoutItem({
          title: shippingAddress,
          label: lang('PaymentShippingAddress'),
          icon: 'location',
          onClick: isInteractive ? handleShippingAddressClick : undefined,
        })}
        {name && renderCheckoutItem({
          title: name,
          label: lang('PaymentCheckoutName'),
          icon: 'user',
        })}
        {phone && renderCheckoutItem({
          title: phone,
          label: lang('PaymentCheckoutPhoneNumber'),
          icon: 'phone',
        })}
        {(hasShippingOptions || !isInteractive) && renderCheckoutItem({
          title: shippingMethod,
          label: lang('PaymentCheckoutShippingMethod'),
          icon: 'truck',
          onClick: isInteractive ? handleShippingMethodClick : undefined,
        })}
        {termsUrl && renderTos(termsUrl)}
      </div>
    </div>
  );
};

export default memo(Checkout);

function renderPaymentItem(
  langCode: LangCode | undefined, title: string, value: number, currency: string, main = false,
) {
  return (
    <div className={buildClassName(styles.priceInfoItem, main && styles.priceInfoItemMain)}>
      <div className={styles.priceInfoItemTitle}>
        {title}
      </div>
      <div>
        {formatCurrency(value, currency, langCode)}
      </div>
    </div>
  );
}

function renderCheckoutItem({
  title,
  label,
  icon,
  customIcon,
  onClick,
}: {
  title : string | undefined;
  label: string | undefined;
  icon?: IconName;
  onClick?: NoneToVoidFunction;
  customIcon?: string;
}) {
  return (
    <ListItem
      multiline={Boolean(title && label !== title)}
      icon={icon}
      inactive={!onClick}
      onClick={onClick}
      leftElement={customIcon && <i className={buildClassName('icon', customIcon)} />}
    >
      <div className={styles.checkoutInfoItemInfoTitle}>
        {title || label}
      </div>
      {title && label !== title && (
        <p className={styles.checkoutInfoItemInfoData}>
          {label}
        </p>
      )}
    </ListItem>
  );
}
