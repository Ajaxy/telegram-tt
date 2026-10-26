import {
  useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiWalletCollectible } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { WalletTransferPayload } from './types';
import type useWalletCredentials from './useWalletCredentials';
import type useWalletNavigation from './useWalletNavigation';
import { EMPTY_SEND_DRAFT, WalletScreen } from './types';

import { getIsWalletTransferSubmitted } from '../../../global/helpers/wallet';
import { selectTabState } from '../../../global/selectors';
import { formatTonFromNanos } from '../../../util/formatCurrency';
import { parseTonTransferAddress } from '../../../util/tonAddress';
import { loadCurrentUserAddress } from './helpers/loadCurrentUserAddress';
import { startSendFlight } from './helpers/sendFlight';

import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';
import useSyncEffect from '../../../hooks/useSyncEffect';

type Options = {
  modal: TabState['walletModal'];
  navigation: ReturnType<typeof useWalletNavigation>;
  credentials: ReturnType<typeof useWalletCredentials>;
  isKeyMissing?: boolean;
  address?: string;
  balance?: bigint;
  collectibles?: ApiWalletCollectible[];
  walletTransfer?: TabState['walletTransfer'];
  isFlightReady?: boolean;
  onKeyMissing: NoneToVoidFunction;
  onFlightStart: NoneToVoidFunction;
};

const SEND_SCREENS = new Set([WalletScreen.Send, WalletScreen.SendAmount]);

export default function useWalletSendFlow({
  modal, navigation, credentials, isKeyMissing, address, balance, collectibles, walletTransfer, isFlightReady,
  onKeyMissing, onFlightStart,
}: Options) {
  const {
    sendWalletTransfer, clearWalletTransfer, clearWalletTransferFee, loadWalletGaslessInfo, closeWalletModal,
    showNotification,
  } = getActions();

  const {
    screen, stack, push, reset: resetNavigation,
  } = navigation;
  const { drop: dropCredentials } = credentials;
  const isSendScreen = SEND_SCREENS.has(screen);

  // Only the main screen shows the history, and the flying diamond lands in its new row. If the diamond cannot be
  // drawn, the flight would be invisible, so a notification reports the transfer instead.
  const canFlightLand = stack[0] === WalletScreen.Main && isFlightReady;

  // The send screen unmounts when another slides over it, so its draft lives here
  const [draft, setDraft] = useState(EMPTY_SEND_DRAFT);

  // A link fills the form once, so a wallet swapped in from another tab does not become the sender
  const appliedLinkRef = useRef<string>();
  // Whether the queued transfer closes the wallet: only the form a chat opened does, until the user leaves it for the
  // main screen, as in the iOS app
  const shouldCloseAfterSendRef = useRef(false);
  const isOpenRef = useStateRef(Boolean(modal));
  const stackRef = useStateRef(stack);

  // Keyed on the values, so a new `modal` object with the same ones does not run the effect again
  const initialRecipient = modal?.initialRecipient;
  const initialAmount = modal?.initialAmount;
  const initialComment = modal?.initialComment;
  const isInitialCommentEncrypted = modal?.isInitialCommentEncrypted;
  const shouldCloseAfterSend = modal?.shouldCloseAfterSend;
  // The key release and a transfer opened from a chat take the screen instead of the form
  const hasOtherStart = Boolean(modal?.shouldReleaseKey || modal?.initialTransactionId);

  useEffect(() => {
    if (hasOtherStart) return;

    if (initialRecipient === undefined) {
      appliedLinkRef.current = undefined;
      shouldCloseAfterSendRef.current = false;
      return;
    }

    if (!address) return;

    // Storage can report a missing phrase after the form opened; the phrase screen must not cover the filled form then
    const linkKey = `${initialRecipient}:${initialAmount}:${initialComment}:${isInitialCommentEncrypted}`;
    if (appliedLinkRef.current === linkKey) return;

    if (isKeyMissing) {
      onKeyMissing();
      return;
    }

    appliedLinkRef.current = linkKey;

    // A comment from a link stays readable to its issuer, e.g. an exchange matching a deposit
    setDraft({
      ...EMPTY_SEND_DRAFT,
      fromAddress: address,
      recipient: initialRecipient,
      recipientQuery: initialRecipient,
      amount: initialAmount === undefined ? '' : formatTonFromNanos(initialAmount),
      comment: initialComment ?? '',
      isCommentPublic: initialComment !== undefined && !isInitialCommentEncrypted,
    });

    clearWalletTransfer();
    loadWalletGaslessInfo();
    shouldCloseAfterSendRef.current = Boolean(shouldCloseAfterSend);
    // The screen opens along with the wallet, and a slide would show the main screen first. A domain from the link
    // is resolved on the recipient screen.
    push(parseTonTransferAddress(initialRecipient) ? WalletScreen.SendAmount : WalletScreen.Send, true);
  }, [
    initialRecipient, initialAmount, initialComment, isInitialCommentEncrypted, shouldCloseAfterSend, hasOtherStart,
    address, isKeyMissing, push, onKeyMissing,
  ]);

  useSyncEffect(() => {
    if (screen === WalletScreen.Main) shouldCloseAfterSendRef.current = false;
  }, [screen]);

  // A transfer started from a chat closes the wallet, leaving the chat where the message appears
  useEffect(() => {
    if (walletTransfer?.status !== 'queued') return;

    clearWalletTransfer();
    setDraft(EMPTY_SEND_DRAFT);
    dropCredentials();

    if (shouldCloseAfterSendRef.current) {
      closeWalletModal();
    } else {
      if (canFlightLand && startSendFlight()) onFlightStart();
      resetNavigation();
    }
  }, [walletTransfer?.status, canFlightLand, dropCredentials, resetNavigation, onFlightStart]);

  const handleBack = useLastCallback(() => {
    if (!isSendScreen) return;

    clearWalletTransferFee();

    // Back to the recipient screen keeps the draft, so the field and the list stay as the user left them
    if (stack[stack.length - 2] !== WalletScreen.Send) setDraft(EMPTY_SEND_DRAFT);
  });

  const reset = useLastCallback(() => {
    setDraft(EMPTY_SEND_DRAFT);
    clearWalletTransferFee();
  });

  const handleOpenSend = useLastCallback(() => {
    if (isKeyMissing) {
      onKeyMissing();
      return;
    }

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setDraft({ ...EMPTY_SEND_DRAFT, fromAddress: address });
    push(WalletScreen.Send);
  });

  const handleSendTo = useLastCallback(async (recipient: string, userId?: string) => {
    if (isKeyMissing) {
      onKeyMissing();
      return;
    }

    const startStack = stack;

    // A record holds the address of its day, and the user may have replaced the wallet since
    const currentAddress = userId ? await loadCurrentUserAddress(userId) : recipient;

    // A late answer is dropped once the user has closed the wallet or left the screen
    if (!isOpenRef.current || stackRef.current !== startStack) return;

    if (currentAddress === '') showNotification({ message: { key: 'WalletLinkNoWallet' } });
    if (!currentAddress) return;

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setDraft({
      ...EMPTY_SEND_DRAFT,
      fromAddress: address,
      recipient: currentAddress,
      recipientUser: userId ? { id: userId, address: currentAddress } : undefined,
    });
    push(WalletScreen.SendAmount);
  });

  const handleOpenCollectibleTransfer = useLastCallback((collectible: ApiWalletCollectible) => {
    if (isKeyMissing) {
      onKeyMissing();
      return;
    }

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setDraft({ ...EMPTY_SEND_DRAFT, fromAddress: address, collectibleAddress: collectible.address });
    push(WalletScreen.Send);
  });

  const handleRecipientContinue = useLastCallback(() => {
    push(WalletScreen.SendAmount);
  });

  const handleSendMax = useLastCallback(() => {
    setDraft({ ...draft, amount: formatTonFromNanos(balance!) });
  });

  const handleSubmit = useLastCallback((payload: WalletTransferPayload) => {
    // The submitted status stops the action from sending twice. A second press before the re-render would clear it, so
    // the press is ignored while the status is set.
    if (getIsWalletTransferSubmitted(selectTabState(getGlobal()).walletTransfer)) return;

    clearWalletTransfer();

    // The passcode and password screens cover the amount screen, so its diamond has nothing to fly from, and a wallet
    // that closes after the transfer has no history for it to land in
    credentials.ask({
      intent: 'send',
      run: (entered) => sendWalletTransfer({
        ...payload,
        ...entered,
        isAnimated: payload.isAnimated && canFlightLand && !entered.passcode && !entered.password
          && !shouldCloseAfterSendRef.current,
        fromAddress: draft.fromAddress!,
      }),
    });
  });

  const collectible = useMemo(
    () => collectibles?.find(({ address: itemAddress }) => itemAddress === draft.collectibleAddress),
    [collectibles, draft.collectibleAddress],
  );

  return {
    draft,
    setDraft,
    collectible,
    isSendScreen,
    handleBack,
    reset,
    handleOpenSend,
    handleSendTo,
    handleOpenCollectibleTransfer,
    handleRecipientContinue,
    handleSendMax,
    handleSubmit,
  };
}
