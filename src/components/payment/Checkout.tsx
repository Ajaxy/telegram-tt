import React, {
  FC, memo,
} from '../../lib/teact/teact';

import { Price } from '../../types';

import './Checkout.scss';

export type OwnProps = {
  invoiceContent?: {
    title?: string;
    description?: string;
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
  // eslint-disable-next-line no-null/no-null
  const { photoUrl, title, text } = (invoiceContent || {});
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
        { photoUrl && (
          <img src={photoUrl} alt="" />
        )}
        <div className="text">
          <h5>{ title }</h5>
          <p>{ text }</p>
        </div>
      </div>
      <div className="price-info">
        { prices && prices.map((item) => (
          renderPaymentItem(item.label, item.amount, currency, false)
        )) }
        { shippingPrices && shippingPrices.map((item) => (
          renderPaymentItem(item.label, item.amount, currency, false)
        )) }
        { totalPrice !== undefined && (
          renderPaymentItem('Total', totalPrice, currency, true)
        ) }
      </div>
      <div className="invoice-info">
        {paymentMethod && renderCheckoutItem('icon-card', paymentMethod, 'Payment method')}
        {paymentProvider && renderCheckoutItem('stripe-provider', paymentProvider, 'Payment provider')}
        {shippingAddress && renderCheckoutItem('icon-location', shippingAddress, 'Shipping address')}
        {name && renderCheckoutItem('icon-user', name, 'Name')}
        {phone && renderCheckoutItem('icon-phone', phone, 'Phone number')}
        {shippingMethod && renderCheckoutItem('icon-truck', shippingMethod, 'Shipping method')}
      </div>
    </div>
  );
};

function renderPaymentItem(title: string, value: number, currency?: string, main = false) {
  return (
    <div className={`price-info-item ${main ? 'price-info-item-main' : ''}`}>
      <div className="title">
        { title }
      </div>
      <div className="value">
        { `${currency || ''} ${(value / 100).toFixed(2)}` }
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
