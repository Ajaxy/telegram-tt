import { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import type { Wish } from '../../types/wish';

import {
  selectWalletCurrency, selectWalletCurrencyRate, selectWish, selectWishDemoBalance,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatTonInFiat, parseTonToNanos } from '../../util/formatCurrency';
import { normalizeAmountInput } from '../modals/wallet/helpers/amount';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import GramIcon from '../common/icons/GramIcon';
import ExpandableTonAmount from '../modals/wallet/ExpandableTonAmount';
import WalletRecentRecipient from '../modals/wallet/WalletRecentRecipient';
import Button from '../ui/Button';
import InputText from '../ui/InputText';
import Link from '../ui/Link';
import TextArea from '../ui/TextArea';
import Island from '@gili/layout/Island';
import Modal, {
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

// The wallet's own styles keep this demo screen identical to the real Send Grams screen
import walletModalStyles from '../modals/wallet/WalletModal.module.scss';
import sendStyles from '../modals/wallet/WalletSendScreen.module.scss';
import styles from './WishSendModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['wishSendModal']>;
  isOpen: boolean;
};

type StateProps = {
  wish?: Wish;
  demoBalanceGram?: number;
  usdRate?: number;
  currency: string;
  currencyRate?: number;
};

// A made-up address: this screen never touches a real wallet
const DEMO_RECIPIENT_ADDRESS = 'UQDEMO-WISH-0000-0000-0000-0000-0000-0000-0000-00';
const GRAM_DECIMALS = 2;
const NANOS_IN_GRAM = 1e9;

const WishSendModal = ({
  isOpen,
  wish,
  demoBalanceGram = 0,
  usdRate,
  currency,
  currencyRate,
}: OwnProps & StateProps) => {
  const {
    closeWishSendModal, startWishBurst, showNotification,
  } = getActions();
  const lang = useLang();

  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [isCommentPublic, setIsCommentPublic] = useState(false);

  const handleClose = useLastCallback(() => {
    closeWishSendModal();
  });

  const handleAmountChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(normalizeAmountInput(e.currentTarget.value, GRAM_DECIMALS));
  });

  const handleCommentChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setComment(e.currentTarget.value);
  });

  const handleCommentLockClick = useLastCallback(() => {
    setIsCommentPublic(!isCommentPublic);
  });

  const handleMaxClick = useLastCallback(() => {
    setAmount(String(demoBalanceGram));
  });

  const handleDepositClick = useLastCallback(() => {
    showNotification({ message: { key: 'WishDemoBalance' } });
  });

  const handleSubmit = useLastCallback(() => {
    const amountGram = Number(amount);
    startWishBurst({ ownerId: wish!.ownerId, amountGram });
    showNotification({ message: { key: 'WishSent', variables: { amount: lang.number(amountGram) } } });
  });

  // The recipient row is fixed to the wish owner
  const handleRecipientSelect = useLastCallback(() => undefined);

  if (!wish) return undefined;

  const amountGram = Number(amount) || 0;
  const amountNanos = amount ? parseTonToNanos(amount) : 0n;
  const isInsufficient = amountGram > demoBalanceGram;
  const canSubmit = amountGram > 0 && !isInsufficient;
  const fiatAmount = amountNanos > 0n
    ? formatTonInFiat(amountNanos, usdRate, currency, currencyRate, lang.code)
    : undefined;

  const header = (
    <ModalHeader className={walletModalStyles.header} noMask>
      <ModalCloseButton className={walletModalStyles.headerButton} />
      <ModalTitle>{lang('WalletSendTitle')}</ModalTitle>
    </ModalHeader>
  );

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      dialogClassName={walletModalStyles.dialog}
      noContentInlinePadding
      noScrollable
      ariaLabel={lang('WalletSendTitle')}
      onClose={handleClose}
    >
      <div className={walletModalStyles.slide}>
        <div className={walletModalStyles.slideContent}>
          <div className={sendStyles.root}>
            <Island className={buildClassName(sendStyles.form, sendStyles.formBeforeSubmit)}>
              <div className={sendStyles.recipientField}>
                <TextArea
                  className="no-margin"
                  label={lang('WalletSendRecipient')}
                  value={DEMO_RECIPIENT_ADDRESS}
                  disabled
                />
              </div>
              <WalletRecentRecipient
                userId={wish.ownerId}
                isLinkedAddress
                className={sendStyles.linkedRecipient}
                onSelect={handleRecipientSelect}
              />
              <div className={styles.wishChip}>
                {lang('WishSendFor', {
                  title: <span className={styles.wishChipTitle} dir="auto">{wish.title}</span>,
                }, { withNodes: true })}
              </div>
              <div className={sendStyles.amountBlock}>
                <div className={sendStyles.amountField}>
                  <GramIcon isMono className={sendStyles.amountIcon} />
                  <InputText
                    className={sendStyles.amountInput}
                    label={lang('WalletSendAmount')}
                    value={amount}
                    inputMode="decimal"
                    noMargin
                    onChange={handleAmountChange}
                  />
                  {fiatAmount && <span className={sendStyles.amountUsd}>{`~${fiatAmount}`}</span>}
                </div>
                <div className={sendStyles.balance}>
                  {lang(
                    'WalletSendBalance',
                    { amount: <ExpandableTonAmount nanos={toNanos(demoBalanceGram)} withTicker /> },
                    { withNodes: true },
                  )}
                  {Boolean(demoBalanceGram) && (
                    <button type="button" className={sendStyles.maxButton} onClick={handleMaxClick}>
                      {lang('WalletSendMax')}
                    </button>
                  )}
                </div>
              </div>
              <div className={sendStyles.commentBlock}>
                <div className={sendStyles.commentField}>
                  <InputText
                    className={sendStyles.commentInput}
                    label={lang('WalletSendComment')}
                    value={comment}
                    noMargin
                    onChange={handleCommentChange}
                  />
                  <Button
                    round
                    size="smaller"
                    color="translucent"
                    className={buildClassName(sendStyles.commentLock, !isCommentPublic && sendStyles.commentLockClosed)}
                    iconName={isCommentPublic ? 'unlock' : 'lock'}
                    ariaLabel={lang(isCommentPublic ? 'WalletPublicCommentInfo' : 'WalletPrivateCommentInfo')}
                    onClick={handleCommentLockClick}
                  />
                </div>
                {Boolean(comment.trim()) && (
                  <div className={sendStyles.commentHint}>
                    {lang(isCommentPublic ? 'WalletPublicCommentInfo' : 'WalletPrivateCommentInfo')}
                  </div>
                )}
              </div>
            </Island>
            <div className={sendStyles.footer}>
              {isInsufficient ? (
                <div className={sendStyles.feeLine}>
                  {lang('WalletSendInsufficientFunds')}
                  {' '}
                  <Link isPrimary onClick={handleDepositClick}>{lang('WalletDepositFunds')}</Link>
                </div>
              ) : (
                <div className={sendStyles.feeLine}>{lang('WalletTransactionFeeFree')}</div>
              )}
              <Button pill disabled={!canSubmit} onClick={handleSubmit}>
                {lang('WalletSendContinue')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

function toNanos(gram: number) {
  return BigInt(Math.round(gram * NANOS_IN_GRAM));
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => ({
    wish: selectWish(global, modal.ownerId),
    demoBalanceGram: selectWishDemoBalance(global),
    usdRate: global.appConfig.tonUsdRate,
    currency: selectWalletCurrency(global),
    currencyRate: selectWalletCurrencyRate(global),
  }),
)(WishSendModal));
