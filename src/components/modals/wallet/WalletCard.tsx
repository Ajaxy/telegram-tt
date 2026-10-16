import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { formatTonInFiat } from '../../../util/formatCurrency';
import { splitAddressInHalves } from '../../../util/tonAddress';
import useCardTilt from './useCardTilt';

import useLang from '../../../hooks/useLang';
import useShrinkToFit from '../../../hooks/useShrinkToFit';

import GramIcon from '../../common/icons/GramIcon';
import Button from '../../ui/Button';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletCardStars from './WalletCardStars';

import styles from './WalletCard.module.scss';

import QrIcon from '../../../assets/wallet-card-qr.svg';

type OwnProps = {
  address: string;
  ownerName?: string;
  balance?: bigint;
  usdRate?: number;
  currency: string;
  currencyRate?: number;
  className?: string;
  onQrClick?: NoneToVoidFunction;
};

const WalletCard = ({
  address, ownerName, balance, usdRate, currency, currencyRate, className, onQrClick,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const amountRef = useRef<HTMLDivElement>();
  const amountContentRef = useRef<HTMLDivElement>();

  useCardTilt(ref);

  useShrinkToFit(amountRef, amountContentRef);

  const [addressStart, addressEnd] = splitAddressInHalves(address);

  const fiatAmount = balance !== undefined && formatTonInFiat(balance, usdRate, currency, currencyRate, lang.code, {
    shouldOmitFractions: true,
  });

  return (
    <div ref={ref} className={buildClassName(styles.root, className)}>
      <div className={styles.card}>
        <div className={styles.texture} aria-hidden />
        <WalletCardStars />
        <div className={styles.glare} aria-hidden />
        <div ref={amountRef} className={styles.amount}>
          <div ref={amountContentRef} className={styles.amountContent}>
            <GramIcon isMono className={styles.gramIcon} />
            <ExpandableTonAmount nanos={balance ?? 0n} fractionClassName={styles.amountFraction} />
            <span className={styles.ticker}>{lang('WalletCurrencyTicker')}</span>
          </div>
        </div>
        {fiatAmount && <div className={styles.fiat}>{fiatAmount}</div>}
        <div className={styles.ownerName}>{ownerName}</div>
        <div className={styles.address} aria-hidden>
          <div className={styles.addressRotator}>
            <span className={styles.addressLine}>{addressStart}</span>
            <span className={styles.addressLine}>{addressEnd}</span>
          </div>
        </div>
        <Button
          className={styles.qrButton}
          ariaLabel={lang('WalletShowAddress')}
          onClick={onQrClick}
        >
          <img src={QrIcon} alt="" draggable={false} className={styles.qrIcon} />
        </Button>
        <div className={styles.innerShadow} aria-hidden />
      </div>
    </div>
  );
};

export default memo(WalletCard);
