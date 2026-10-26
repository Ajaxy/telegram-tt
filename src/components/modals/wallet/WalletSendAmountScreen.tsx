import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiUser, ApiWalletCollectible, ApiWalletGaslessInfo, ApiWalletUserAddress,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type StandaloneDiamond from '../../../lib/diamond/standalone';
import type { WalletSendDraft, WalletTransferPayload } from './types';

import {
  GRAM_TRANSFER_FEE_RESERVE, NFT_TRANSFER_ATTACHED_NANOS, WALLET_COMMENT_MAX_BYTES,
} from '../../../config';
import { toNonBounceableAddress } from '../../../lib/ton/address';
import {
  buildWalletTransferFeeKey, getIsWalletTransferSubmitted, getMainUsername, getUserFullName,
} from '../../../global/helpers';
import {
  selectCanAnimateInterface, selectTabState, selectWalletCurrency, selectWalletCurrencyRate,
} from '../../../global/selectors';
import areShallowEqual from '../../../util/areShallowEqual';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { bufferFromUtf8 } from '../../../util/encoding/buffer';
import { formatTonFromNanos, formatTonInFiat, parseTonToNanos } from '../../../util/formatCurrency';
import { getBigIntMax } from '../../../util/numbers';
import { parseTonTransferAddress } from '../../../util/tonAddress';
import { REFUSAL_VIBRATION } from './helpers/amountFrames';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletAmountField, { type AmountFieldControls } from './WalletAmountField';
import WalletCollectibleImage from './WalletCollectibleImage';
import WalletFeesInfoDialog from './WalletFeesInfoDialog';
import WalletRecipientChip from './WalletRecipientChip';
import WalletRecipientInfoDialog from './WalletRecipientInfoDialog';

import styles from './WalletSendAmountScreen.module.scss';

type OwnProps = {
  isActive: boolean;
  draft: WalletSendDraft;
  collectible?: ApiWalletCollectible;
  onSubmit: (payload: WalletTransferPayload) => void;
  onDraftChange: (draft: WalletSendDraft) => void;
  onBuy: NoneToVoidFunction;
};

type StateProps = {
  balance?: bigint;
  usdRate?: number;
  currency: string;
  currencyRate?: number;
  usersById: Record<string, ApiUser>;
  // Empty for a user without a wallet, absent until asked
  userAddresses?: Record<string, string>;
  resolvedAddresses?: Record<string, ApiWalletUserAddress | false>;
  walletTransfer?: TabState['walletTransfer'];
  walletTransferFee?: TabState['walletTransferFee'];
  gaslessInfo?: ApiWalletGaslessInfo;
  freeTransfersPerDay?: number;
  // Nanotons. The server accepts smaller transfers but leaves them out of the history.
  minAmount?: bigint;
  canAnimate?: boolean;
  // `Modal` freezes its content while it closes, so the screen learns about the closing from here
  isModalOpen: boolean;
};

const FEE_DEBOUNCE_MS = 400;
const COMMENT_COUNTER_THRESHOLD = 100;

const WalletSendAmountScreen = (props: OwnProps & StateProps) => {
  const {
    loadWalletUserAddresses, loadWalletTransferFee, showNotification, closeWalletModal, openChat,
  } = getActions();

  const { isActive, isModalOpen } = props;

  // A screen leaving with its slide or the modal keeps its last values, so nothing changes under the animation
  const formProps = useFrozenProps(props, !isActive || !isModalOpen);
  const {
    usdRate, currency, currencyRate, usersById, userAddresses, resolvedAddresses,
    walletTransfer, walletTransferFee, gaslessInfo, freeTransfersPerDay, minAmount, canAnimate,
    draft, collectible,
    onSubmit, onDraftChange, onBuy,
  } = formProps;

  const isSubmitted = getIsWalletTransferSubmitted(walletTransfer);
  // A submitted transfer lowers the balance at once, and its amount would then show as more than the balance. So the
  // balance stays as it was before the transfer.
  const { balance } = useFrozenProps(formProps, isSubmitted);

  const lang = useLang();

  const diamondRef = useRef<StandaloneDiamond>();
  const amountControlsRef = useRef<AmountFieldControls>();
  const submitTimeoutRef = useRef<number>();
  const [isFeesInfoOpen, openFeesInfo, closeFeesInfo] = useFlag();
  const [isRecipientInfoOpen, openRecipientInfo, closeRecipientInfo] = useFlag();
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const isActiveRef = useStateRef(isActive);

  const {
    recipient, amount, comment, isCommentPublic, collectibleAddress,
  } = draft;

  const updateDraft = useLastCallback((update: Partial<WalletSendDraft>) => {
    onDraftChange({ ...draft, ...update });
  });

  // The item contract pays its fees from the fixed amount and returns the rest
  const amountNanos = collectibleAddress
    ? NFT_TRANSFER_ATTACHED_NANOS
    : parseTonToNanos(amount);

  // Emptying the wallet is a distinct transfer mode, where the fees come out of the amount itself
  const shouldSendAll = !collectibleAddress && amountNanos === balance;
  const toAddress = recipient.trim();
  const normalizedRecipient = parseTonTransferAddress(toAddress) ? toNonBounceableAddress(toAddress) : undefined;
  const resolvedRecipient = normalizedRecipient ? resolvedAddresses?.[normalizedRecipient] : undefined;

  // Naming the person lets the server show each side of the transfer to the other, even without a chat
  const recipientUserId = (draft.recipientUser?.address === recipient ? draft.recipientUser.id : undefined)
    || (resolvedRecipient && resolvedRecipient.userId)
    || Object.entries(userAddresses || {}).find(([, address]) => address === normalizedRecipient)?.[0];
  const isRecipientResolved = Boolean(recipientUserId) || !normalizedRecipient || resolvedRecipient !== undefined;

  const recipientUser = recipientUserId ? usersById[recipientUserId] : undefined;
  const recipientUsername = recipientUser && getMainUsername(recipientUser);

  useEffect(() => {
    if (!normalizedRecipient) return;

    loadWalletUserAddresses({ addresses: [normalizedRecipient] });
  }, [normalizedRecipient]);

  const trimmedComment = comment.trim();

  // The item contract delivers the comment to the new owner as plain text, so it cannot be encrypted
  const shouldEncryptComment = Boolean(trimmedComment) && !isCommentPublic && !collectibleAddress;
  const commentBytesLeft = WALLET_COMMENT_MAX_BYTES - bufferFromUtf8(trimmedComment).length;
  const isCommentTooLong = commentBytesLeft < 0;

  // The estimate is debounced, so it is only used while it matches what is typed now
  const feePayload = useMemo(() => ({
    toAddress,
    comment: trimmedComment || undefined,
    shouldEncryptComment,
    collectibleAddress,
  }), [toAddress, trimmedComment, shouldEncryptComment, collectibleAddress]);
  const currentFee = walletTransferFee?.key === buildWalletTransferFeeKey(feePayload) ? walletTransferFee : undefined;

  // The recipient's wallet has no key to encrypt for yet
  const isCommentEncryptionUnavailable = shouldEncryptComment && currentFee?.canEncryptComment === false;

  // When the estimate fails, the fixed reserve is the only fee the transfer could rely on, and a payload can cost more
  const hasFeeFailed = Boolean(currentFee?.isFailed);

  // The API's safety reserve is kept even for gasless transfers, which may fall back to a regular message
  const estimatedFee = currentFee?.fee;
  const feeToCover = getBigIntMax(estimatedFee ?? 0n, GRAM_TRANSFER_FEE_RESERVE);

  // The relayer takes neither collectibles nor transfers to the wallet itself
  const isSelfTransfer = Boolean(normalizedRecipient && draft.fromAddress)
    && normalizedRecipient === toNonBounceableAddress(draft.fromAddress!);

  // The quota and the minimum are the server's word on relayed transfers. A wallet with no code yet is the one
  // thing the client knows the relayer cannot carry, and only the estimate tells whether the wallet has code.
  const canBeGasless = !collectibleAddress && !isSelfTransfer
    && Boolean(gaslessInfo?.isAvailable && gaslessInfo.left > 0 && amountNanos >= gaslessInfo.minAmount);
  const isGasless = canBeGasless && Boolean(currentFee?.canUseRelayer);
  const requiredNanos = shouldSendAll ? amountNanos : amountNanos + feeToCover;
  const isBelowMin = Boolean(!collectibleAddress && minAmount && amountNanos > 0n && amountNanos < minAmount);
  const isInsufficient = balance !== undefined && amountNanos > 0n && requiredNanos > balance;

  const canSubmit = Boolean(normalizedRecipient)
    && amountNanos > 0n
    && !isBelowMin
    && !isCommentTooLong
    && !isCommentEncryptionUnavailable
    && !isInsufficient
    && !hasFeeFailed;

  // Confirmed before the estimate, the transfer would go out with neither the fee nor the payer shown, so a press
  // waits for the estimate
  const [isSubmitPending, markSubmitPending, unmarkSubmitPending] = useFlag();
  const pendingDraftRef = useRef<WalletSendDraft>();

  // Until the next estimate comes, the status keeps the last one rather than blinking at every key
  const lastFee = useCurrentOrPrev(currentFee, true);
  const shownFee = amountNanos > 0n ? lastFee : undefined;
  const canShowFeesInfo = Boolean(shownFee?.fee && freeTransfersPerDay);

  // The dialog goes away with the fee, and the flag must not keep the keys off or bring it back later
  useEffect(() => {
    if (!canShowFeesInfo) closeFeesInfo();
  }, [canShowFeesInfo, closeFeesInfo]);

  const debouncedLoadFee = useDebouncedCallback(loadWalletTransferFee, [loadWalletTransferFee], FEE_DEBOUNCE_MS, true);

  // The screen stays mounted after Back, which clears the estimate, so a return asks again
  useEffect(() => {
    if (!isActive || !normalizedRecipient) return;

    debouncedLoadFee(feePayload);
  }, [isActive, feePayload, normalizedRecipient, debouncedLoadFee]);

  // A failed estimate is tried again on the next key, so a network hiccup does not lock the button
  useEffectWithPrevDeps(([prevAmountNanos]) => {
    if (!hasFeeFailed || amountNanos === prevAmountNanos) return;

    debouncedLoadFee(feePayload);
  }, [amountNanos, hasFeeFailed, feePayload, debouncedLoadFee]);

  const handleSubmit = useLastCallback(() => {
    window.clearTimeout(submitTimeoutRef.current);
    // The screen stays mounted after it is left, and a submit delayed by the currency swap must not fire there
    if (!isActiveRef.current || !isModalOpen) return;

    if (!canSubmit || isSubmitted) {
      navigator.vibrate?.(REFUSAL_VIBRATION);
      amountControlsRef.current?.shake();
      return;
    }

    if (!currentFee) {
      pendingDraftRef.current = draft;
      markSubmitPending();
      return;
    }

    // A transfer always goes in grams, so an amount in fiat rolls back to grams first
    const swap = amountControlsRef.current?.showGrams();
    if (swap) {
      const swappedDraft = { ...draft, amount: swap.amount };
      submitTimeoutRef.current = window.setTimeout(() => submitAfterSwap(swappedDraft), swap.delay);
      return;
    }

    onSubmit({
      ...feePayload,
      amount: amountNanos,
      shouldSendAll,
      isGasless,
      toUserId: recipientUserId,
      isAnimated: Boolean(diamondRef.current) && canAnimate,
    });
  });

  // Any edit during the currency swap cancels the press, so the transfer goes out exactly as the user last saw it
  const submitAfterSwap = useLastCallback((swappedDraft: WalletSendDraft) => {
    if (areShallowEqual(draft, swappedDraft)) handleSubmit();
  });

  useEffectOnce(() => () => window.clearTimeout(submitTimeoutRef.current));

  // An edit while the press waits drops it, so the transfer goes out only as the user last saw it
  useEffect(() => {
    if (!isSubmitPending) return;

    if (draft !== pendingDraftRef.current) {
      unmarkSubmitPending();
      return;
    }

    if (!currentFee) return;

    unmarkSubmitPending();
    handleSubmit();
  }, [isSubmitPending, draft, currentFee, unmarkSubmitPending]);

  const handleAmountChange = useLastCallback((nextAmount: string) => {
    updateDraft({ amount: nextAmount });
  });

  // The lock button shares the field, and keys typed while it has focus go to the amount
  const handleCommentFieldFocus = useLastCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setIsCommentFocused(e.target instanceof HTMLInputElement);
  });

  const handleCommentFieldBlur = useLastCallback(() => {
    setIsCommentFocused(false);
  });

  const handleCopyAddress = useLastCallback(() => {
    copyTextToClipboard(shownAddress);
    showNotification({ message: { key: 'WalletAddressCopied' } });
  });

  const handleOpenRecipientChat = useLastCallback(() => {
    closeWalletModal();
    openChat({ id: recipientUserId! });
  });

  const handleRecipientInfoCopy = useLastCallback(() => {
    closeRecipientInfo();
    handleCopyAddress();
  });

  const handleRecipientInfoOpenChat = useLastCallback(() => {
    closeRecipientInfo();
    handleOpenRecipientChat();
  });

  const handleCommentChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraft({ comment: e.currentTarget.value });
  });

  const handleCommentKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.isComposing) handleSubmit();
  });

  const handleCommentLockClick = useLastCallback(() => {
    updateDraft({ isCommentPublic: !isCommentPublic });
  });

  const fiatFee = shownFee?.fee
    ? formatTonInFiat(shownFee.fee, usdRate, currency, currencyRate, lang.code, { isPrecise: true })
    : undefined;

  const isLaunching = isSubmitted && canAnimate && Boolean(diamondRef.current);
  const submitText = collectibleAddress ? lang('WalletSendCollectibleTitle')
    : amountNanos > 0n
      ? lang('WalletSendAmountButton', { amount: `${formatTonFromNanos(amountNanos)} ${lang('WalletCurrencyTicker')}` })
      : lang('WalletSendTitle');
  const shownAddress = normalizedRecipient || toAddress;
  const recipientName = recipientUser && getUserFullName(lang, recipientUser);
  const recipientInfoTitle = recipientName
    ? lang('WalletSendRecipientWallet', { name: recipientUser.firstName || recipientName })
    : lang('WalletSendUnlinkedWallet');

  return (
    <div className={buildClassName(styles.root, isLaunching && styles.launching)}>
      <WalletRecipientChip
        address={shownAddress}
        user={recipientUser}
        infoLabel={recipientInfoTitle}
        isResolved={isRecipientResolved}
        isActive={isActive}
        noAnimation={!canAnimate}
        onCopyAddress={handleCopyAddress}
        onOpenChat={isSubmitted ? undefined : handleOpenRecipientChat}
        onOpenInfo={normalizedRecipient && !isSubmitted ? openRecipientInfo : undefined}
      />
      {collectible ? (
        <div className={styles.collectible}>
          <WalletCollectibleImage collectible={collectible} className={styles.collectibleImage} />
          <div className={styles.collectibleName}>{collectible.name ?? lang('WalletCollectibleTitle')}</div>
        </div>
      ) : (
        <WalletAmountField
          amount={amount}
          currency={currency}
          usdRate={usdRate}
          currencyRate={currencyRate}
          isActive={isActive}
          isSubmitted={isSubmitted}
          isLaunching={isLaunching}
          noKeyCapture={!isModalOpen || isFeesInfoOpen || isRecipientInfoOpen}
          noCaret={isFeesInfoOpen || isRecipientInfoOpen || isCommentFocused}
          noAnimation={!canAnimate}
          diamondRef={diamondRef}
          controlsRef={amountControlsRef}
          onAmountChange={handleAmountChange}
          onSubmit={handleSubmit}
        />
      )}
      <div className={styles.status}>
        {isBelowMin ? (
          lang(
            'WalletSendMinAmount',
            { amount: <ExpandableTonAmount nanos={minAmount!} withTicker /> },
            { withNodes: true },
          )
        ) : isCommentEncryptionUnavailable ? (
          lang('WalletCommentEncryptionUnavailable')
        ) : isInsufficient ? (
          <>
            {lang('WalletSendInsufficientFunds')}
            {' '}
            <Link isPrimary onClick={onBuy}>{lang('WalletDepositFunds')}</Link>
          </>
        ) : shownFee?.isFailed ? (
          lang('WalletSendFeeUnavailable')
        ) : canBeGasless && shownFee?.canUseRelayer ? (
          <>
            {lang('WalletTransactionFeeFree')}
            {canShowFeesInfo && (
              <Button
                round
                size="tiny"
                color="translucent-primary"
                className={styles.feeInfoButton}
                iconName="help"
                ariaLabel={lang('WalletNetworkFeesTitle')}
                onClick={openFeesInfo}
              />
            )}
          </>
        ) : Boolean(shownFee?.fee) && (
          lang(
            'WalletSendNetworkFee',
            { amount: <ExpandableTonAmount nanos={shownFee.fee} withTicker /> },
            { withNodes: true },
          )
        )}
      </div>
      <div className={styles.commentBlock} inert={isSubmitted}>
        <div className={styles.commentField} onFocus={handleCommentFieldFocus} onBlur={handleCommentFieldBlur}>
          <InputText
            className={buildClassName(!collectibleAddress && styles.commentInput)}
            label={lang('WalletSendComment')}
            value={comment}
            error={isCommentTooLong ? lang('WalletCommentTooLong') : undefined}
            maxLengthIndicator={
              commentBytesLeft <= COMMENT_COUNTER_THRESHOLD ? String(commentBytesLeft) : undefined
            }
            noMargin
            onChange={handleCommentChange}
            onKeyDown={handleCommentKeyDown}
          />
          {!collectibleAddress && (
            <Button
              round
              size="smaller"
              color="translucent"
              className={buildClassName(styles.commentLock, !isCommentPublic && styles.commentLockClosed)}
              iconName={isCommentPublic ? 'unlock' : 'lock'}
              ariaLabel={lang(isCommentPublic ? 'WalletPublicCommentInfo' : 'WalletPrivateCommentInfo')}
              onClick={handleCommentLockClick}
            />
          )}
        </div>
        {Boolean(trimmedComment) && (
          <div className={styles.commentHint}>
            {lang(shouldEncryptComment ? 'WalletPrivateCommentInfo' : 'WalletPublicCommentInfo')}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <Button
          pill
          disabled={!canSubmit || isSubmitted}
          isLoading={isSubmitted || isSubmitPending}
          onClick={handleSubmit}
        >
          {submitText}
        </Button>
      </div>
      <WalletRecipientInfoDialog
        isOpen={isRecipientInfoOpen}
        address={shownAddress}
        recipientName={recipientUser && (recipientUsername ? `@${recipientUsername}` : recipientName)}
        title={recipientInfoTitle}
        onOpenChat={handleRecipientInfoOpenChat}
        onCopyAddress={handleRecipientInfoCopy}
        onClose={closeRecipientInfo}
      />
      {canShowFeesInfo && (
        <WalletFeesInfoDialog
          isOpen={isFeesInfoOpen}
          fiatFee={fiatFee}
          freeTransfersPerDay={freeTransfersPerDay!}
          onClose={closeFeesInfo}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);

    return {
      balance: global.wallet?.state?.balance,
      usdRate: global.appConfig.tonUsdRate,
      currency: selectWalletCurrency(global),
      currencyRate: selectWalletCurrencyRate(global),
      usersById: global.users.byId,
      userAddresses: global.wallet?.userAddresses,
      resolvedAddresses: global.wallet?.resolvedAddresses,
      walletTransfer: tabState.walletTransfer,
      walletTransferFee: tabState.walletTransferFee,
      gaslessInfo: global.wallet?.gaslessInfo,
      freeTransfersPerDay: global.appConfig.walletGaslessDailyTransfers,
      minAmount: global.appConfig.walletTransferMinNanos,
      canAnimate: selectCanAnimateInterface(global),
      isModalOpen: Boolean(tabState.walletModal),
    };
  },
)(WalletSendAmountScreen));
