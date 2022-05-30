import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { LangCode, Price } from '../../types';

import { formatCurrency } from '../../util/formatCurrency';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import './Checkout.scss';

export type OwnProps = {
  invoiceContent?: {
    title?: string;
    text?: string;
    photoUrl?: string;
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
  currency?: string;
};

const Checkout: FC<OwnProps> = ({
  invoiceContent,
  prices,
  shippingPrices,
  checkoutInfo,
  currency,
  totalPrice,
}) => {
  const lang = useLang();

  const { photoUrl, title, text } = invoiceContent || {};
  const {
    paymentMethod,
    paymentProvider,
    shippingAddress,
    name,
    phone,
    shippingMethod,
  } = (checkoutInfo || {});

  return (
    <div className="Checkout">
      <div className="description has-image">
        {photoUrl && <img src={photoUrl} alt="" />}
        <div className="text">
          <h5>{title}</h5>
          <p>{text}</p>
        </div>
      </div>
      <div className="price-info">
        { prices && prices.map((item) => (
          renderPaymentItem(lang.code, item.label, item.amount, currency)
        )) }
        { shippingPrices && shippingPrices.map((item) => (
          renderPaymentItem(lang.code, item.label, item.amount, currency)
        )) }
        { totalPrice !== undefined && (
          renderPaymentItem(lang.code, lang('Checkout.TotalAmount'), totalPrice, currency, true)
        ) }
      </div>
      <div className="invoice-info">
        {paymentMethod && renderCheckoutItem('icon-card', paymentMethod, lang('PaymentCheckoutMethod'))}
        {paymentProvider && renderCheckoutItem(
          buildClassName('provider', paymentProvider.toLowerCase()),
          paymentProvider,
          lang('PaymentCheckoutProvider'),
        )}
        {shippingAddress && renderCheckoutItem('icon-location', shippingAddress, lang('PaymentShippingAddress'))}
        {name && renderCheckoutItem('icon-user', name, lang('PaymentCheckoutName'))}
        {phone && renderCheckoutItem('icon-phone', phone, lang('PaymentCheckoutPhoneNumber'))}
        {shippingMethod && renderCheckoutItem('icon-truck', shippingMethod, lang('PaymentCheckoutShippingMethod'))}
      </div>
    </div>
  );
};

function renderPaymentItem(
  langCode: LangCode | undefined, title: string, value: number, currency?: string, main = false,
) {
  return (
    <div className={`price-info-item ${main ? 'price-info-item-main' : ''}`}>
      <div className="title">
        { title }
      </div>
      <div className="value">
        {formatCurrency(value, currency, langCode)}
      </div>
    </div>
  );
}

function renderCheckoutItem(icon: string, title: string, data: string) {
  return (
    <div className="checkout-info-item">
      <i className={icon}> </i>
      <div className="info">
        <div className="title">
          { title }
        </div>
        <p className="data">
          { data }
        </p>
      </div>
    </div>
  );
}

export default memo(Checkout);
