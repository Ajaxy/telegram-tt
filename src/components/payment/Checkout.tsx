import type { FC } from '../../lib/teact/teact';
import { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiInvoice,
  ApiLabeledPrice,
  ApiPaymentCredentials,
  ApiWebDocument,
} from '../../api/types';
import type { FormEditDispatch } from '../../hooks/reducers/usePaymentReducer';
import type { IconName } from '../../types/icons';
import type { LangFn } from '../../util/localization';
import { PaymentStep } from '../../types';

import { getWebDocumentHash } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatCurrency';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useOldLang from '../../hooks/useOldLang';

import SafeLink from '../common/SafeLink';
import Checkbox from '../ui/Checkbox';
import ListItem from '../ui/ListItem';
import Skeleton from '../ui/placeholder/Skeleton';

import styles from './Checkout.module.scss';

export type OwnProps = {
  title: string;
  description: string;
  photo?: ApiWebDocument;
  invoice: ApiInvoice;
  checkoutInfo?: {
    paymentMethod?: string;
    paymentProvider?: string;
    shippingAddress?: string;
    name?: string;
    phone?: string;
    shippingMethod?: string;
  };
  totalPrice?: number;
  needAddress?: boolean;
  hasShippingOptions?: boolean;
  tipAmount?: number;
  shippingPrices?: ApiLabeledPrice[];
  isTosAccepted?: boolean;
  dispatch?: FormEditDispatch;
  onAcceptTos?: (isAccepted: boolean) => void;
  savedCredentials?: ApiPaymentCredentials[];
  isPaymentFormUrl?: boolean;
  botName?: string;
};

const Checkout: FC<OwnProps> = ({
  title,
  description,
  photo,
  invoice,
  shippingPrices,
  checkoutInfo,
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

  const oldLang = useOldLang();
  const lang = useLang();
  const isInteractive = Boolean(dispatch);

  const {
    termsUrl, suggestedTipAmounts, maxTipAmount,
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

  const { ref } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(photoUrl),
  });

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
            {formatCurrency(lang, tipAmount!, invoice.currency)}
          </div>
        </div>
        <div className={styles.tipsList}>
          {suggestedTipAmounts!.map((tip) => (
            <div
              key={tip}
              className={buildClassName(styles.tipsItem, tip === tipAmount && styles.tipsItem_active)}
              onClick={dispatch ? () => handleTipsClick(tip === tipAmount ? 0 : tip) : undefined}
            >
              {formatCurrency(lang, tip, invoice.currency, { shouldOmitFractions: true })}
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderTosLink(url: string, isRtl?: boolean) {
    const langString = oldLang('PaymentCheckoutAcceptRecurrent', botName);
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
        {photoUrl && (
          <img
            ref={ref}
            className={styles.checkoutPicture}
            src={photoUrl}
            draggable={false}
            width={photo!.dimensions?.width}
            height={photo!.dimensions?.height}
            alt=""
          />
        )}
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
          {description && (
            <div className={styles.checkoutDescription}>
              {renderText(description, ['br', 'links', 'emoji'])}
            </div>
          )}
        </div>
      </div>
      <div className={styles.priceInfo}>
        {invoice.prices.map((item) => (
          renderPaymentItem(lang, item.label, item.amount, invoice.currency)
        ))}
        {shippingPrices && shippingPrices.map((item) => (
          renderPaymentItem(lang, item.label, item.amount, invoice.currency)
        ))}
        {suggestedTipAmounts && suggestedTipAmounts.length > 0 && renderTips()}
        {totalPrice !== undefined && (
          renderPaymentItem(lang, oldLang('Checkout.TotalAmount'), totalPrice, invoice.currency, true)
        )}
      </div>
      <div className={styles.invoiceInfo}>
        {!isPaymentFormUrl && renderCheckoutItem({
          title: paymentMethod || savedCredentials?.[0].title,
          label: oldLang('PaymentCheckoutMethod'),
          icon: 'card',
          onClick: isInteractive ? handlePaymentMethodClick : undefined,
        })}
        {paymentProvider && renderCheckoutItem({
          title: paymentProvider,
          label: oldLang('PaymentCheckoutProvider'),
          customIcon: buildClassName(styles.provider, styles[paymentProvider.toLowerCase()]),
        })}
        {(needAddress || (!isInteractive && shippingAddress)) && renderCheckoutItem({
          title: shippingAddress,
          label: oldLang('PaymentShippingAddress'),
          icon: 'location',
          onClick: isInteractive ? handleShippingAddressClick : undefined,
        })}
        {name && renderCheckoutItem({
          title: name,
          label: oldLang('PaymentCheckoutName'),
          icon: 'user',
        })}
        {phone && renderCheckoutItem({
          title: phone,
          label: oldLang('PaymentCheckoutPhoneNumber'),
          icon: 'phone',
        })}
        {(hasShippingOptions || (!isInteractive && shippingMethod)) && renderCheckoutItem({
          title: shippingMethod,
          label: oldLang('PaymentCheckoutShippingMethod'),
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
  lang: LangFn, title: string, value: number, currency: string, main = false,
) {
  return (
    <div className={buildClassName(styles.priceInfoItem, main && styles.priceInfoItemMain)}>
      <div className={styles.priceInfoItemTitle}>
        {title}
      </div>
      <div>
        {formatCurrency(lang, value, currency)}
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
  title: string | undefined;
  label: string | undefined;
  icon?: IconName;
  onClick?: NoneToVoidFunction;
  customIcon?: string;
}) {
  const isMultiline = Boolean(title && label !== title);

  return (
    <ListItem
      className={styles.list}
      narrow
      multiline={isMultiline}
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
