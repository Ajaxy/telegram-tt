import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { LangCode, Price } from '../../types';
import type { ApiChat, ApiWebDocument } from '../../api/types';

import { getWebDocumentHash } from '../../global/helpers';
import { formatCurrency } from '../../util/formatCurrency';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';

import Checkbox from '../ui/Checkbox';
import Skeleton from '../ui/Skeleton';
import SafeLink from '../common/SafeLink';

import styles from './Checkout.module.scss';

export type OwnProps = {
  chat?: ApiChat;
  invoiceContent?: {
    title?: string;
    text?: string;
    photo?: ApiWebDocument;
    isRecurring?: boolean;
    recurringTermsUrl?: string;
  };
  checkoutInfo?: {
    paymentMethod?: string;
    paymentProvider?: string;
    shippingAddress?: string;
    name?: string;
    phone?: string;
    shippingMethod?: string;
  };
  prices?: Price[];
  totalPrice?: number;
  shippingPrices?: Price[];
  currency: string;
  isTosAccepted?: boolean;
  onAcceptTos?: (isAccepted: boolean) => void;
};

const Checkout: FC<OwnProps> = ({
  chat,
  invoiceContent,
  prices,
  shippingPrices,
  checkoutInfo,
  currency,
  totalPrice,
  isTosAccepted,
  onAcceptTos,
}) => {
  const lang = useLang();

  const {
    photo, title, text, isRecurring, recurringTermsUrl,
  } = invoiceContent || {};
  const {
    paymentMethod,
    paymentProvider,
    shippingAddress,
    name,
    phone,
    shippingMethod,
  } = (checkoutInfo || {});

  const photoUrl = useMedia(getWebDocumentHash(photo));

  function renderTosLink(url: string, isRtl?: boolean) {
    const langString = lang('PaymentCheckoutAcceptRecurrent', chat?.title);
    const langStringSplit = langString.split('*');
    return (
      <>
        {langStringSplit[0]}
        <SafeLink
          url={url}
          text=""
          isRtl={isRtl}
        >
          {langStringSplit[1]}
        </SafeLink>
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
        {photoUrl && <img className={styles.checkoutPicture} src={photoUrl} alt="" />}
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
        {totalPrice !== undefined && (
          renderPaymentItem(lang.code, lang('Checkout.TotalAmount'), totalPrice, currency, true)
        )}
      </div>
      <div className={styles.invoiceInfo}>
        {paymentMethod && renderCheckoutItem('icon-card', paymentMethod, lang('PaymentCheckoutMethod'))}
        {paymentProvider && renderCheckoutItem(
          buildClassName(styles.provider, styles[paymentProvider.toLowerCase()]),
          paymentProvider,
          lang('PaymentCheckoutProvider'),
        )}
        {shippingAddress && renderCheckoutItem('icon-location', shippingAddress, lang('PaymentShippingAddress'))}
        {name && renderCheckoutItem('icon-user', name, lang('PaymentCheckoutName'))}
        {phone && renderCheckoutItem('icon-phone', phone, lang('PaymentCheckoutPhoneNumber'))}
        {shippingMethod && renderCheckoutItem('icon-truck', shippingMethod, lang('PaymentCheckoutShippingMethod'))}
        {isRecurring && renderTos(recurringTermsUrl!)}
      </div>
    </div>
  );
};

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

function renderCheckoutItem(icon: string, title: string, data: string) {
  return (
    <div className={styles.checkoutInfoItem}>
      <i className={buildClassName(icon, styles.checkoutInfoItemIcon)}> </i>
      <div className={styles.checkoutInfoItemInfo}>
        <div className={styles.checkoutInfoItemInfoTitle}>
          {title}
        </div>
        <p className={styles.checkoutInfoItemInfoData}>
          {data}
        </p>
      </div>
    </div>
  );
}

export default memo(Checkout);
