import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiOnrampProvider } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';

import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { normalizeAmountInput } from './helpers/amount';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GramIcon from '../../common/icons/GramIcon';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import RadioGroup from '../../ui/RadioGroup';
import Spinner from '../../ui/Spinner';
import Island, { IslandTitle } from '@gili/layout/Island';

import styles from './WalletBuyAmountScreen.module.scss';

type StateProps = {
  walletBuy?: TabState['walletBuy'];
  providers?: ApiOnrampProvider[];
};

type ChipOwnProps = {
  value: string;
  label: string;
  isActive: boolean;
  onSelect: (value: string) => void;
};

const QUOTE_DEBOUNCE_MS = 500;
const METHOD_WORD_SEPARATOR_REGEX = /_/g;
const WORD_INITIAL_REGEX = /\b\w/g;

// MoonPay may also send device- and region-dependent codes not listed here
const PAYMENT_METHOD_LANG_KEYS: Record<string, RegularLangKey> = {
  balance: 'WalletBuyMethodWalletBalance',
  cross_chain: 'WalletBuyMethodCrossChain',
  p2p_express: 'WalletBuyMethodP2pExpress',
  credit_debit_card: 'WalletBuyMethodCard',
  paypal: 'WalletBuyMethodPaypal',
  ach_bank_transfer: 'WalletBuyMethodAchBankTransfer',
  sepa_bank_transfer: 'WalletBuyMethodSepaBankTransfer',
  gbp_bank_transfer: 'WalletBuyMethodGbpBankTransfer',
  gbp_open_banking_payment: 'WalletBuyMethodOpenBanking',
  pix_instant_payment: 'WalletBuyMethodPix',
  apple_pay: 'WalletBuyMethodApplePay',
  google_pay: 'WalletBuyMethodGooglePay',
  venmo: 'WalletBuyMethodVenmo',
};

const WalletBuyAmountScreen = ({ walletBuy, providers }: StateProps) => {
  const {
    loadOnrampQuote, loadOnrampLimits, openOnrampSession, setWalletBuyCurrency,
  } = getActions();

  const lang = useLang();

  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | undefined>();

  const provider = walletBuy?.provider;
  const providerInfo = useMemo(() => providers?.find(({ id }) => id === provider), [providers, provider]);
  const hasBaseCurrencies = Boolean(providerInfo?.hasBaseCurrencies);
  const hasQuote = Boolean(providerInfo?.hasQuote);
  const hasLimits = Boolean(providerInfo?.hasLimits);
  const { baseCurrencies, limits, isQuoteLoading } = walletBuy || {};

  // Until the debounced refresh answers, the quote on hand belongs to the previous choice
  const quote = walletBuy?.quoteBaseAmount === amount && walletBuy.quotePaymentMethod === selectedMethod
    ? walletBuy.quote : undefined;

  const baseCurrency = walletBuy?.baseCurrency || '';
  const displayFiat = baseCurrency.toUpperCase();

  const methodOptions = useMemo(() => (
    (walletBuy?.availability?.methods || []).filter(({ isAvailable }) => isAvailable).map(({ paymentMethod }) => {
      const langKey = PAYMENT_METHOD_LANG_KEYS[paymentMethod];

      return { value: paymentMethod, label: langKey ? lang(langKey) : humanizeMethod(paymentMethod) };
    })
  ), [walletBuy?.availability, lang]);

  useEffect(() => {
    setSelectedMethod(undefined);
  }, [baseCurrency]);

  const numericAmount = Number(amount);
  const min = limits ? Number(limits.baseMinAmount) : undefined;
  const max = limits ? Number(limits.baseMaxAmount) : undefined;
  const isBelowMin = min !== undefined && numericAmount > 0 && numericAmount < min;
  const isAboveMax = max !== undefined && numericAmount > max;

  // A failed limits lookup must not open a checkout the provider then refuses
  const isAmountValid = numericAmount > 0 && !isBelowMin && !isAboveMax && (!hasLimits || limits !== undefined);

  const debouncedLoadQuote = useDebouncedCallback(
    (amountValue: string, currency: string, method?: string) => {
      loadOnrampQuote({ baseCurrency: currency, baseAmount: amountValue, paymentMethod: method });
    },
    [],
    QUOTE_DEBOUNCE_MS,
    true,
  );

  useEffect(() => {
    if (!hasQuote || !isAmountValid) return;

    debouncedLoadQuote(amount, baseCurrency, selectedMethod);
  }, [amount, baseCurrency, selectedMethod, hasQuote, isAmountValid, debouncedLoadQuote]);

  const handleAmountChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(normalizeAmountInput(e.currentTarget.value));
  });

  const handleFiatSelect = useLastCallback((fiat: string) => {
    setWalletBuyCurrency({ baseCurrency: fiat });
  });

  const handleMethodSelect = useLastCallback((method: string) => {
    setSelectedMethod(method);
    loadOnrampLimits({ paymentMethod: method });
  });

  const handleBuy = useLastCallback(() => {
    if (!provider || !isAmountValid) return;

    openOnrampSession({
      provider, baseCurrency, baseAmount: amount, paymentMethod: selectedMethod,
    });
  });

  if (!walletBuy || walletBuy.status === 'loading') {
    return (
      <div className={buildClassName(styles.root, styles.centered)}>
        <Spinner color="blue" />
      </div>
    );
  }

  if (walletBuy.status === 'unavailable') {
    return (
      <div className={buildClassName(styles.root, styles.centered)}>
        <div className={styles.sticker}>🌍</div>
        <div className={styles.message}>{lang('WalletBuyUnavailable')}</div>
      </div>
    );
  }

  const shouldShowQuote = hasQuote && isAmountValid;
  const hasExtraFee = quote && Number(quote.extraFeeAmount) > 0;

  return (
    <div className={styles.root}>
      {hasBaseCurrencies && baseCurrencies && baseCurrencies.length > 0 && (
        <div className={styles.chips}>
          {baseCurrencies.map((fiat) => (
            <Chip
              key={fiat}
              value={fiat}
              label={fiat.toUpperCase()}
              isActive={fiat === baseCurrency}
              onSelect={handleFiatSelect}
            />
          ))}
        </div>
      )}

      <div className={styles.amountField}>
        <InputText
          className={styles.amountInput}
          label={lang('WalletBuyAmountLabel', { currency: displayFiat })}
          value={amount}
          inputMode="decimal"
          error={isBelowMin || isAboveMax ? lang('WalletBuyMinMax', { min: min!, max: max! }) : undefined}
          noMargin
          onChange={handleAmountChange}
        />
      </div>

      {Boolean(methodOptions.length) && (
        <div>
          <IslandTitle>{lang('PaymentCheckoutMethod')}</IslandTitle>
          <Island>
            <RadioGroup
              name="wallet-payment-method"
              options={methodOptions}
              selected={selectedMethod}
              onChange={handleMethodSelect}
            />
          </Island>
        </div>
      )}

      {shouldShowQuote && (
        <div className={styles.quote}>
          {isQuoteLoading && !quote ? (
            <Spinner color="blue" className={styles.quoteSpinner} />
          ) : quote && (
            <>
              <div className={styles.youGet}>
                <GramIcon isMono className={styles.youGetIcon} />
                <span className={styles.youGetAmount}>{quote.cryptoAmount}</span>
                <span className={styles.youGetLabel}>{lang('WalletBuyYouGet')}</span>
              </div>
              <div className={styles.rows}>
                <div className={styles.row}>
                  <span>{lang('WalletBuyFee')}</span>
                  <span>{`${quote.feeAmount} ${displayFiat}`}</span>
                </div>
                {hasExtraFee && (
                  <div className={styles.row}>
                    <span>{lang('WalletBuyExtraFee')}</span>
                    <span>{`${quote.extraFeeAmount} ${displayFiat}`}</span>
                  </div>
                )}
                <div className={styles.row}>
                  <span>{lang('WalletBuyNetworkFee')}</span>
                  <span>{`${quote.networkFeeAmount} ${displayFiat}`}</span>
                </div>
                <div className={buildClassName(styles.row, styles.total)}>
                  <span>{lang('WalletBuyTotal')}</span>
                  <span>{`${quote.totalAmount} ${displayFiat}`}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Button className={styles.button} pill disabled={!isAmountValid} onClick={handleBuy}>
        {lang('WalletBuyContinue')}
      </Button>
    </div>
  );
};

const Chip = memo(({ value, label, isActive, onSelect }: ChipOwnProps) => {
  const handleClick = useLastCallback(() => {
    onSelect(value);
  });

  return (
    <button
      type="button"
      className={buildClassName(styles.chip, isActive && styles.chipActive)}
      onClick={handleClick}
    >
      {label}
    </button>
  );
});

function humanizeMethod(method: string) {
  return method.replace(METHOD_WORD_SEPARATOR_REGEX, ' ').replace(WORD_INITIAL_REGEX, (char) => char.toUpperCase());
}

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    return {
      walletBuy: selectTabState(global).walletBuy,
      providers: global.wallet?.onrampProviders,
    };
  },
)(WalletBuyAmountScreen));
