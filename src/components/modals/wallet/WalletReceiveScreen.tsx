import {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { STRICTERDOM_ENABLED } from '../../../config';
import { disableStrict, enableStrict } from '../../../lib/fasterdom/stricterdom';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';
import { getAddressGroupSeparator, splitAddressIntoGroups } from '../../../util/tonAddress';

import useAsync from '../../../hooks/useAsync';
import useClickable from '../../../hooks/useClickable';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import WalletAddressRing from './WalletAddressRing';

import styles from './WalletReceiveScreen.module.scss';

import QrLogo from '../../../assets/wallet-qr-logo.svg';

type OwnProps = {
  address: string;
  isPeer?: boolean;
  onBuyClick?: NoneToVoidFunction;
};

const QR_SIZE = 180;
// The card padding is the quiet zone
const QR_MARGIN = 0;
// Clears a 9×9 square in a 33×33 code, close to the 44px hole in the design
const QR_HOLE_RATIO = 0.5;
const BACK_GROUPS_PER_LINE = 3;

const WalletReceiveScreen = ({ address, isPeer, onBuyClick }: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const qrRef = useRef<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement>();
  const drawTokenRef = useRef(0);

  const [isAddressShown, showAddress, hideAddress] = useFlag();
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>();

  useResizeObserver(cardRef, ({ contentRect }) => {
    setCardSize({ width: contentRect.width, height: contentRect.height });
  });

  // The logo is laid over the blank hole in CSS; error correction covers the modules under it
  const { result: qrCode, error: qrCodeError } = useAsync(() => createStyledQrCode({
    size: QR_SIZE,
    margin: QR_MARGIN,
    imageSize: QR_HOLE_RATIO,
  }), []);

  const handleCopy = useLastCallback(() => {
    copyTextToClipboard(address);
    showAddress();
  });

  const clickableProps = useClickable(handleCopy);

  useLayoutEffect(() => {
    if (!qrCode) return;

    const container = qrRef.current!;
    const token = ++drawTokenRef.current;

    // The library draws into the mounted SVG asynchronously, outside the mutation phase
    if (STRICTERDOM_ENABLED) {
      disableStrict();
    }

    qrCode.update({ data: address });
    qrCode.append(container);

    if (STRICTERDOM_ENABLED) {
      void qrCode.getRawData('svg').finally(() => {
        if (drawTokenRef.current === token) {
          enableStrict();
        }
      });
    }
  }, [qrCode, address]);

  useEffect(() => {
    if (!qrCodeError) return;

    showNotification({ message: { key: 'ErrorUnexpected' } });
  }, [qrCodeError]);

  const groups = splitAddressIntoGroups(address);

  return (
    <div className={styles.root}>
      <div className={styles.qrCard}>
        <div ref={cardRef} className={buildClassName(styles.card, isAddressShown && styles.flipped)}>
          <div className={buildClassName(styles.face, styles.front)} inert={isAddressShown} {...clickableProps}>
            <div className={styles.qr}>
              <div ref={qrRef} className={styles.qrCode} />
              <img src={QrLogo} alt="" draggable={false} className={styles.qrLogo} />
            </div>
            <div className={styles.addressBlock}>
              <div className={styles.address}>
                {groups.map((group, index) => (
                  <span key={index} className={index % 2 ? styles.addressGroupMuted : undefined}>
                    {group}
                    {getAddressGroupSeparator(index, groups.length)}
                  </span>
                ))}
              </div>
              <div className={styles.copyHint}>{lang('WalletReceiveCopyHint')}</div>
            </div>
          </div>
          <div className={buildClassName(styles.face, styles.back)} inert={!isAddressShown}>
            <div className={styles.backAddress}>
              {groups.map((group, index) => (
                <span key={index} className={index % 2 ? styles.addressGroupMuted : undefined}>
                  {group}
                  {index < groups.length - 1 && ((index + 1) % BACK_GROUPS_PER_LINE ? ' ' : '\n')}
                </span>
              ))}
            </div>
            <div className={styles.copied}>
              <Icon name="check" />
              {lang('WalletReceiveAddressCopied')}
            </div>
            <Button className={styles.showQr} size="smaller" pill isText onClick={hideAddress}>
              {lang(isPeer ? 'WalletReceivePeerShowQr' : 'WalletReceiveShowQr')}
            </Button>
          </div>
        </div>
        {/* Teact matches these children by position, so a ring appearing before the card after the first measure would
            remount the card and drop the QR code the library has drawn into it */}
        {cardSize && <WalletAddressRing address={address} width={cardSize.width} height={cardSize.height} />}
      </div>
      <div className={styles.note}>{lang(isPeer ? 'WalletReceivePeerNote' : 'WalletReceiveNetworkNote')}</div>
      {onBuyClick && (
        <Button
          className={styles.buyButton}
          color="secondary"
          pill
          iconName="cash-circle-filled"
          iconClassName={styles.buyIcon}
          onClick={onBuyClick}
        >
          {lang('WalletReceiveBuy')}
        </Button>
      )}
    </div>
  );
};

export default memo(WalletReceiveScreen);
