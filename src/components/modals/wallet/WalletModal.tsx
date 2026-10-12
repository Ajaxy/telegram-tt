import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiTonConnectSession, ApiWalletCollectible, ApiWalletTransaction } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { AnimationLevel } from '../../../types';
import type { RegularLangKey } from '../../../types/language';
import type { WalletTransferPayload } from './WalletSendScreen';
import { SettingsScreens } from '../../../types';
import { WalletScreen } from './types';

import { TON_CURRENCY_CODE, WALLET_FIRST_TRANSFER_SUGGESTION } from '../../../config';
import { WALLET_ERROR_LANG_KEYS } from '../../../global/helpers';
import {
  selectCanExportWalletPhrase, selectIsWalletKeyMissing, selectTabState, selectTonExplorerUrl, selectWalletAddress,
  selectWalletPublicKey,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import { formatTonFromNanos } from '../../../util/formatCurrency';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { getAddressGroupSeparator, splitAddressIntoGroups } from '../../../util/tonAddress';
import { loadCurrentUserAddress } from './helpers/loadCurrentUserAddress';
import useWalletCredentials from './useWalletCredentials';
import useWalletKeyFlows from './useWalletKeyFlows';
import useWalletNavigation from './useWalletNavigation';

import useInterval from '../../../hooks/schedulers/useInterval';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import DropdownMenu from '../../ui/DropdownMenu';
import Link from '../../ui/Link';
import MenuItem from '../../ui/MenuItem';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import WalletBuyAmountScreen from './WalletBuyAmountScreen';
import WalletBuyScreen from './WalletBuyScreen';
import WalletCollectibleScreen from './WalletCollectibleScreen';
import WalletConnectedAppScreen from './WalletConnectedAppScreen';
import WalletConnectedAppsScreen from './WalletConnectedAppsScreen';
import WalletCurrencyScreen from './WalletCurrencyScreen';
import WalletDeleteScreen from './WalletDeleteScreen';
import WalletDisableBackupScreen from './WalletDisableBackupScreen';
import WalletEnterPhraseScreen from './WalletEnterPhraseScreen';
import WalletHowItWorksScreen from './WalletHowItWorksScreen';
import WalletIntroScreen from './WalletIntroScreen';
import WalletMainScreen from './WalletMainScreen';
import WalletPasscodeRequiredScreen from './WalletPasscodeRequiredScreen';
import WalletPasswordScreen from './WalletPasswordScreen';
import WalletPhraseInfoScreen from './WalletPhraseInfoScreen';
import WalletPhraseScreen from './WalletPhraseScreen';
import WalletReceiveScreen from './WalletReceiveScreen';
import WalletReleaseKeyScreen from './WalletReleaseKeyScreen';
import WalletReplaceScreen from './WalletReplaceScreen';
import WalletSendScreen, { EMPTY_SEND_DRAFT } from './WalletSendScreen';
import WalletSettingsScreen from './WalletSettingsScreen';
import WalletSlide from './WalletSlide';
import WalletTonConnectLoginScreen from './WalletTonConnectLoginScreen';
import WalletTonConnectScreen from './WalletTonConnectScreen';
import WalletTransactionScreen from './WalletTransactionScreen';
import Modal, {
  ModalCloseButton, ModalHeader, ModalHeaderAction, ModalTitle,
} from '@gili/modal/Modal';

import styles from './WalletModal.module.scss';

export type OwnProps = {
  modal: TabState['walletModal'];
};

type StateProps = {
  canExportPhrase?: boolean;
  // The backup is off and the phrase is not on this device, so the wallet cannot sign
  isKeyMissing?: boolean;
  hasLocalSecret?: boolean;
  hasAppPasscode?: boolean;
  address?: string;
  publicKey?: string;
  tonExplorerUrl: string;
  transactions?: ApiWalletTransaction[];
  loadedTransactions?: Record<string, ApiWalletTransaction>;
  collectibles?: ApiWalletCollectible[];
  walletTransfer?: TabState['walletTransfer'];
  walletMnemonic?: TabState['walletMnemonic'];
  walletBackup?: TabState['walletBackup'];
  walletReplace?: TabState['walletReplace'];
  walletCommentDecryption?: TabState['walletCommentDecryption'];
  walletTonConnect?: TabState['walletTonConnect'];
  tonConnectSessions?: ApiTonConnectSession[];
  decryptedComments?: Record<string, string>;
  animationLevel: AnimationLevel;
};

const ACCENT_SCREENS = new Set([WalletScreen.Receive]);

const SCREEN_TITLE_KEYS: Partial<Record<WalletScreen, RegularLangKey>> = {
  [WalletScreen.Main]: 'WalletTitle',
  [WalletScreen.Receive]: 'WalletReceiveTitle',
  [WalletScreen.Buy]: 'WalletBuyTitle',
  [WalletScreen.BuyAmount]: 'WalletBuyTitle',
  [WalletScreen.Currency]: 'WalletBuyCurrency',
  [WalletScreen.Send]: 'WalletSendTitle',
  [WalletScreen.Transaction]: 'WalletTransactionTitle',
  [WalletScreen.Collectible]: 'WalletCollectibleTitle',
  [WalletScreen.Settings]: 'WalletSettingsTitle',
  [WalletScreen.Password]: 'CheckPasswordTitle',
  [WalletScreen.Passcode]: 'WalletPasscodeTitle',
  [WalletScreen.TonConnect]: 'WalletConnectScreenTitle',
  [WalletScreen.ConnectedApps]: 'WalletConnectedApps',
};

// The server caches the balance for about this long
const POLL_INTERVAL = 30000;

const WalletModal = ({
  modal, canExportPhrase, isKeyMissing, hasLocalSecret, hasAppPasscode, address, publicKey, tonExplorerUrl,
  transactions, loadedTransactions, collectibles, walletTransfer, walletMnemonic, walletBackup, walletReplace,
  walletCommentDecryption, walletTonConnect, tonConnectSessions, decryptedComments, animationLevel,
}: OwnProps & StateProps) => {
  const {
    openWalletModal, closeWalletModal, loadWalletState, loadWalletTransactions, sendWalletTransfer,
    clearWalletTransfer, loadWalletBuyContext, clearWalletBuy, clearWalletTransferFee, decryptWalletComment,
    clearWalletCommentDecryption, loadWalletGaslessInfo, dropWalletVaultSecrets, openSettingsScreen, openUrl,
    watchWalletActivity, unwatchWalletActivity, openStarsBalanceModal, loadWalletCollectibles,
    unlockWalletTonConnectRequest, respondWalletTonConnect, connectWalletTonConnectOauth, disconnectWalletTonConnect,
    clearWalletTonConnect, closeUrlAuthModal,
    disconnectAllWalletTonConnect, dismissWalletIntro, dismissSuggestion,
    showNotification,
  } = getActions();

  const lang = useLang();

  // Kept through the closing animation, or the slide would swing to the main screen as the dialog fades out
  const rootScreen = useCurrentOrPrev(
    modal && (modal.shouldOpenTonConnect ? WalletScreen.TonConnect
      : modal.initialTransactionId ? (modal.shouldShowIntro ? WalletScreen.Intro : WalletScreen.Transaction)
        : WalletScreen.Main), true,
  ) ?? WalletScreen.Main;
  const navigation = useWalletNavigation(rootScreen);
  const {
    screen, stack, direction, isInstant, push, back, reset,
  } = navigation;

  // A connection prompt replaces the root; the screens pushed so far would otherwise hide it
  useEffect(() => {
    if (rootScreen === WalletScreen.TonConnect) {
      reset();
    }
  }, [rootScreen, reset]);

  const credentials = useWalletCredentials({
    navigation,
    hasLocalSecret,
    walletTransfer,
    walletMnemonic,
    walletBackup,
    walletReplace,
    walletCommentDecryption,
    walletTonConnect,
  });
  const { intent: credentialIntent, drop: dropCredentials } = credentials;
  const hasSubmittedTonConnectRef = useRef(false);

  const keysFlows = useWalletKeyFlows({
    navigation,
    credentials,
    hasAppPasscode,
    hasLocalSecret,
    walletMnemonic,
    walletBackup,
    walletReplace,
    ownAddress: address,
    ownPublicKey: publicKey,
  });
  const { pendingReplace, wrongPhrase, handleImportOwnWallet } = keysFlows;

  const [isPhraseWhyOpen, openPhraseWhy, closePhraseWhy] = useFlag();

  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>();
  const [selectedCollectibleAddress, setSelectedCollectibleAddress] = useState<string | undefined>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState(0);

  // The send screen unmounts when another slides over it, so its draft lives here
  const [sendDraft, setSendDraft] = useState(EMPTY_SEND_DRAFT);

  const mainSlideRef = useRef<HTMLDivElement>();

  // A link fills the form once, so a wallet swapped in from another tab does not become the sender
  const appliedLinkRef = useRef<string>();

  const isOpen = Boolean(modal);

  // Names the screen the hairline was measured on, so a screen that opens fresh starts without it
  const [scrolledScreen, setScrolledScreen] = useState<WalletScreen | undefined>();
  const isScrolled = scrolledScreen === screen;
  const handleSlideScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrolledScreen(e.currentTarget.scrollTop > 0 ? screen : undefined);
  });

  useEffect(() => {
    setScrolledScreen(undefined);
  }, [screen]);

  const hasWallet = Boolean(address);

  useInterval(() => {
    loadWalletState();
    loadWalletTransactions({ shouldRefresh: true });

    if (collectibles) {
      loadWalletCollectibles({ shouldRefresh: true });
    }
  }, isOpen ? POLL_INTERVAL : undefined);

  // The poll above stays as the fallback for when the socket is down
  useEffect(() => {
    if (!isOpen || !address) return undefined;

    watchWalletActivity();

    return unwatchWalletActivity;
  }, [isOpen, address]);

  // Screens like Receive have nothing to show without an address, so the modal falls back to the main screen
  useEffect(() => {
    if (isOpen && !address) reset();
  }, [isOpen, address, reset]);

  // Keyed on the values, so a new `modal` object with the same ones does not run the effect again
  const initialRecipient = modal?.initialRecipient;
  const initialAmount = modal?.initialAmount;
  const initialComment = modal?.initialComment;
  const isInitialCommentEncrypted = modal?.isInitialCommentEncrypted;
  const shouldCloseAfterSend = modal?.shouldCloseAfterSend;
  const shouldReleaseKey = modal?.shouldReleaseKey;
  const initialTransactionId = modal?.initialTransactionId;

  // The record's own id can differ from the one the chat names when the transfer came from the chain
  const initialTransactionRecordId = useMemo(() => {
    if (!initialTransactionId) return undefined;

    const listed = transactions?.find(({ id }) => id === initialTransactionId);

    return (listed || loadedTransactions?.[initialTransactionId])?.id;
  }, [transactions, loadedTransactions, initialTransactionId]);

  useEffect(() => {
    if (shouldReleaseKey) {
      push(WalletScreen.ReleaseKey);
      return;
    }

    if (initialTransactionId) {
      setSelectedTransactionId(initialTransactionRecordId);
      return;
    }

    if (initialRecipient === undefined) {
      appliedLinkRef.current = undefined;
      return;
    }

    if (!address) return;

    // Storage can report a missing phrase after the form opened; the phrase screen must not cover the filled form then
    const linkKey = `${initialRecipient}:${initialAmount}:${initialComment}:${isInitialCommentEncrypted}`;
    if (appliedLinkRef.current === linkKey) return;

    if (isKeyMissing) {
      handleImportOwnWallet();
      return;
    }

    appliedLinkRef.current = linkKey;

    // A comment from a link stays readable to its issuer, e.g. an exchange matching a deposit
    setSendDraft({
      ...EMPTY_SEND_DRAFT,
      fromAddress: address,
      recipient: initialRecipient,
      amount: initialAmount === undefined ? '' : formatTonFromNanos(initialAmount),
      comment: initialComment ?? '',
      isCommentPublic: initialComment !== undefined && !isInitialCommentEncrypted,
    });

    clearWalletTransfer();
    loadWalletGaslessInfo();
    // The form opens along with the wallet, and a slide would show the main screen first
    push(WalletScreen.Send, true);
  }, [
    initialRecipient, initialAmount, initialComment, isInitialCommentEncrypted, shouldReleaseKey,
    initialTransactionId,
    initialTransactionRecordId, address, isKeyMissing, push, handleImportOwnWallet,
  ]);

  const handleCloseAnimationEnd = useLastCallback(() => {
    reset();
    credentials.reset();
    keysFlows.reset();
    closePhraseWhy();
    setSelectedTransactionId(undefined);
    setSelectedCollectibleAddress(undefined);
    setSelectedSessionId(undefined);
    setSendDraft(EMPTY_SEND_DRAFT);
    setActiveTab(0);
    clearWalletBuy();
    clearWalletTransferFee();

    // An abandoned login sends nothing: the site's session expires on the server
    if (walletTonConnect?.oauth && walletTonConnect.status !== 'done') {
      closeUrlAuthModal();
    }

    clearWalletTonConnect();
  });

  // A request already out keeps its flow until the answer lands, or the form could be sent again.
  // Reading the phrase or a comment changes nothing on the server, so leaving just drops the answer.
  const isReading = credentials.intent === 'phrase' || credentials.intent === 'decrypt';
  const isRequestPending = (credentials.flow?.status === 'pending' && !isReading)
    || walletTonConnect?.status === 'pending';

  const handleClose = useLastCallback(() => {
    if (isRequestPending) return;

    closeWalletModal();
  });

  const handleBack = useLastCallback(() => {
    if (isRequestPending) return;

    credentials.handleBack();
    keysFlows.handleBack();

    // A late decryption answer is dropped; without a request its `PASSWORD_MISSING` cannot open the password screen
    if (screen === WalletScreen.Transaction) {
      clearWalletCommentDecryption();
      credentials.drop();
    }

    if (screen === WalletScreen.BuyAmount) {
      clearWalletBuy();
    }

    if (screen === WalletScreen.Send) {
      setSendDraft(EMPTY_SEND_DRAFT);
      clearWalletTransferFee();
    }

    back();
  });

  const handleSendSubmit = useLastCallback((payload: WalletTransferPayload) => {
    clearWalletTransfer();

    credentials.ask({
      intent: 'send',
      run: (entered) => sendWalletTransfer({ ...payload, ...entered, fromAddress: sendDraft.fromAddress! }),
    });
  });

  const handleOpenSettings = useLastCallback(() => {
    push(WalletScreen.Settings);
  });

  const handleOpenConnectedApps = useLastCallback(() => {
    clearWalletTonConnect();
    push(WalletScreen.ConnectedApps);
  });

  const handleTonConnectUnlock = useLastCallback(() => {
    const { session, request } = walletTonConnect!;
    if (!session || !request) return;

    credentials.ask({ intent: 'tonConnect', run: (entered) => {
      hasSubmittedTonConnectRef.current = true;
      unlockWalletTonConnectRequest({ sessionId: session.id, requestMsgId: request.msgId, ...entered });
    } });
  });

  const handleTonConnectConfirm = useLastCallback(() => {
    const { session, request, oauth } = walletTonConnect!;
    if (!session && !oauth) return;

    credentials.ask({ intent: 'tonConnect', run: (entered) => {
      hasSubmittedTonConnectRef.current = true;

      if (oauth) {
        connectWalletTonConnectOauth(entered);
      } else {
        respondWalletTonConnect({ sessionId: session!.id, requestMsgId: request?.msgId, ...entered });
      }
    } });
  });

  const handleTonConnectDecline = useLastCallback(() => {
    const { session, request, connectRequest, oauth } = walletTonConnect!;

    if (oauth) {
      closeWalletModal();
      return;
    }

    if (!session) return;

    // Telling the dApp would take the session key, and so the phrase, for a step that should cost nothing
    if (connectRequest) {
      clearWalletTonConnect();
      closeWalletModal();
      return;
    }

    credentials.ask({
      intent: 'tonConnect', run: (entered) => {
        hasSubmittedTonConnectRef.current = true;

        respondWalletTonConnect({
          sessionId: session.id, requestMsgId: request?.msgId, ...entered, isDeclined: true,
        });
      },
    });
  });

  const handleTonConnectDisconnect = useLastCallback((sessionId: string) => {
    credentials.ask({ intent: 'tonConnect', run: (entered) => {
      hasSubmittedTonConnectRef.current = true;
      disconnectWalletTonConnect({ sessionId, ...entered });
    } });
  });

  const handleTonConnectDisconnectAll = useLastCallback(() => {
    credentials.ask({ intent: 'tonConnect', run: (entered) => {
      hasSubmittedTonConnectRef.current = true;
      disconnectAllWalletTonConnect(entered);
    } });
  });

  const handleOpenConnectedApp = useLastCallback((session: ApiTonConnectSession) => {
    // A flow finished on the list, such as a disconnect, would send the app screen straight back
    clearWalletTonConnect();
    setSelectedSessionId(session.id);
    push(WalletScreen.ConnectedApp);
  });

  const selectedSession = useMemo(
    () => tonConnectSessions?.find(({ id }) => id === selectedSessionId),
    [tonConnectSessions, selectedSessionId],
  );

  // The finished flow stays while the screen slides away, so the disconnect button keeps its spinner
  useEffect(() => {
    if (walletTonConnect?.status !== 'done' || screen !== WalletScreen.ConnectedApp) return;

    back();
  }, [walletTonConnect?.status, screen, back]);

  useEffect(() => {
    if (!hasSubmittedTonConnectRef.current || !walletTonConnect || walletTonConnect.status === 'pending') return;

    // The password demand reopens its screen and clears the flow; this submission must not close that screen
    if (walletTonConnect.status === 'error' && walletTonConnect.error === 'PASSWORD_MISSING') {
      hasSubmittedTonConnectRef.current = false;
      return;
    }

    hasSubmittedTonConnectRef.current = false;

    if (walletTonConnect.status === 'error' || credentialIntent !== 'tonConnect'
      || (screen !== WalletScreen.Passcode && screen !== WalletScreen.Password)) {
      return;
    }

    dropCredentials();
    back();
  }, [credentialIntent, screen, walletTonConnect, dropCredentials, back]);

  const handleProtectAccount = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.TwoFaDisabled });
    closeWalletModal();
  });

  const handleOpenEarnings = useLastCallback(() => {
    closeWalletModal();
    openStarsBalanceModal({ currency: TON_CURRENCY_CODE });
  });

  const handleOpenPasscodeSettings = useLastCallback(() => {
    openSettingsScreen({ screen: hasAppPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled });
    closeWalletModal();
  });

  const handleOpenHowItWorks = useLastCallback(() => {
    push(WalletScreen.HowItWorks);
  });

  const handleReleaseKeyRemove = useLastCallback(() => {
    dropWalletVaultSecrets();
  });

  // A sent transfer is listed under its message hash until the chain confirms it under its own id
  const selectedTransaction = useMemo(() => {
    if (!selectedTransactionId) return undefined;

    const isSelected = ({ id, msgHash }: ApiWalletTransaction) => (
      id === selectedTransactionId || msgHash === selectedTransactionId
    );

    return transactions?.find(isSelected) || Object.values(loadedTransactions || {}).find(isSelected);
  }, [transactions, loadedTransactions, selectedTransactionId]);

  const handleDecryptComment = useLastCallback(() => {
    clearWalletCommentDecryption();

    const transactionId = selectedTransaction!.id;
    credentials.ask({ intent: 'decrypt', run: (entered) => decryptWalletComment({ transactionId, ...entered }) });
  });

  // The decrypted text lands in the transaction details, so the password screen that unlocked it makes way
  const decryptedComment = selectedTransaction ? decryptedComments?.[selectedTransaction.id] : undefined;

  useEffect(() => {
    if (!decryptedComment || credentialIntent !== 'decrypt'
      || (screen !== WalletScreen.Password && screen !== WalletScreen.Passcode)) {
      return;
    }

    dropCredentials();
    back();
  }, [decryptedComment, screen, credentialIntent, dropCredentials, back]);

  // Leaving the form of the transfer the wallet was opened for gives the flag up
  const shouldCloseAfterSendRef = useRef(false);

  useSyncEffect(() => {
    if (shouldCloseAfterSend && screen === WalletScreen.Send) shouldCloseAfterSendRef.current = true;

    if (screen === WalletScreen.Main) shouldCloseAfterSendRef.current = false;
  }, [shouldCloseAfterSend, screen]);

  // A transfer started from a chat closes the wallet, leaving the chat where the message appears
  useEffect(() => {
    const isShownInChat = walletTransfer?.isShownInChat && shouldCloseAfterSendRef.current;
    if (walletTransfer?.status !== 'sent' && !isShownInChat) return;

    clearWalletTransfer();
    setSendDraft(EMPTY_SEND_DRAFT);
    dropCredentials();

    if (shouldCloseAfterSendRef.current) {
      closeWalletModal();
    } else {
      reset();
    }
  }, [walletTransfer?.status, walletTransfer?.isShownInChat, dropCredentials, reset]);

  const handleOpenInExplorer = useLastCallback(() => {
    const url = `${tonExplorerUrl}transaction/${encodeURIComponent(selectedTransaction!.txHash!)}`;

    // The explorer comes from the app config, so the open-link prompt is skipped
    openUrl({ url, shouldSkipModal: true });
  });

  // Dismissing the intro re-roots the modal on the transfer screen and tells the server not to offer it again
  const handleIntroDone = useLastCallback(() => {
    dismissWalletIntro();
    dismissSuggestion({ suggestion: WALLET_FIRST_TRANSFER_SUGGESTION });
  });

  const isTransactionRoot = stack.length === 1;
  const handleTransactionDone = useLastCallback(() => {
    if (isTransactionRoot) {
      openWalletModal();
    } else {
      handleBack();
    }
  });

  const handleOpenTransaction = useLastCallback((transaction: ApiWalletTransaction) => {
    setSelectedTransactionId(transaction.id);
    push(WalletScreen.Transaction);
  });

  const selectedCollectible = useMemo(
    () => collectibles?.find(({ address: itemAddress }) => itemAddress === selectedCollectibleAddress),
    [collectibles, selectedCollectibleAddress],
  );

  const handleOpenCollectible = useLastCallback((collectible: ApiWalletCollectible) => {
    setSelectedCollectibleAddress(collectible.address);
    push(WalletScreen.Collectible);
  });

  const handleOpenReceive = useLastCallback(() => {
    push(WalletScreen.Receive);
  });

  const handleOpenBuy = useLastCallback(() => {
    push(WalletScreen.Buy);
  });

  const handleOpenCurrency = useLastCallback(() => {
    push(WalletScreen.Currency);
  });

  const handleProviderSelect = useLastCallback((provider: string) => {
    loadWalletBuyContext({ provider });
    push(WalletScreen.BuyAmount);
  });

  const handleOpenSend = useLastCallback(() => {
    if (isKeyMissing) {
      handleImportOwnWallet();
      return;
    }

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setSendDraft({ ...EMPTY_SEND_DRAFT, fromAddress: address });
    push(WalletScreen.Send);
  });

  const handleSendTo = useLastCallback(async (recipient: string, userId?: string) => {
    if (isKeyMissing) {
      handleImportOwnWallet();
      return;
    }

    // A record holds the address of its day, and the user may have replaced the wallet since
    const currentAddress = userId ? await loadCurrentUserAddress(userId) : recipient;
    if (currentAddress === '') showNotification({ message: { key: 'WalletLinkNoWallet' } });
    if (!currentAddress) return;

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setSendDraft({ ...EMPTY_SEND_DRAFT, fromAddress: address, recipient: currentAddress });
    push(WalletScreen.Send);
  });

  const handleOpenCollectibleTransfer = useLastCallback((collectible: ApiWalletCollectible) => {
    if (isKeyMissing) {
      handleImportOwnWallet();
      return;
    }

    clearWalletTransfer();
    loadWalletGaslessInfo();
    setSendDraft({ ...EMPTY_SEND_DRAFT, fromAddress: address, collectibleAddress: collectible.address });
    push(WalletScreen.Send);
  });

  const sendCollectible = useMemo(
    () => collectibles?.find(({ address: itemAddress }) => itemAddress === sendDraft.collectibleAddress),
    [collectibles, sendDraft.collectibleAddress],
  );

  const wrongPhraseGroups = wrongPhrase?.address ? splitAddressIntoGroups(wrongPhrase.address) : undefined;

  // Memoized: the phrase screen is a memo component, and a new node each render would re-render it while the user types
  const isOwnPhraseExpected = Boolean(pendingReplace?.isOwnExpected);
  const enterPhraseSubtitle = useMemo(() => (
    isOwnPhraseExpected
      ? lang('WalletSecretPhraseSubtitle', {
        why: <Link isPrimary onClick={openPhraseWhy}>{lang('WalletSecretPhraseWhy')}</Link>,
      }, { withNodes: true })
      : lang(pendingReplace ? 'WalletImportPhraseSubtitle' : 'WalletEnterPhraseSubtitle')
  ), [isOwnPhraseExpected, pendingReplace, lang, openPhraseWhy]);

  const screenTitleKey = screen === WalletScreen.Send && sendDraft.collectibleAddress
    ? 'WalletSendCollectibleTitle' : SCREEN_TITLE_KEYS[screen];
  const transitionName = resolveTransitionName('layers', animationLevel, isInstant);

  const header = (
    <ModalHeader
      className={buildClassName(
        styles.header,
        ACCENT_SCREENS.has(screen) && styles.headerOnAccent,
        isScrolled && !ACCENT_SCREENS.has(screen) && styles.headerScrolled,
      )}
      noMask
    >
      <ModalCloseButton className={styles.headerButton} onBack={stack.length > 1 ? handleBack : undefined} />
      <ModalTitle>
        <Transition
          name={isInstant ? 'none' : 'slideVerticalFade'}
          activeKey={screen}
          direction={direction}
          className={styles.headerTitle}
        >
          {screenTitleKey ? lang(screenTitleKey) : ' '}
        </Transition>
      </ModalTitle>
      {screen === WalletScreen.Main && hasWallet && (
        <ModalHeaderAction>
          <Button
            round
            color="translucent"
            size="tiny"
            ariaLabel={lang('WalletSettingsTitle')}
            onClick={handleOpenSettings}
          >
            <Icon name="settings" />
          </Button>
        </ModalHeaderAction>
      )}
      {screen === WalletScreen.Transaction && (
        <ModalHeaderAction>
          <DropdownMenu className={styles.headerMenu} trigger={HeaderMenuButton} positionX="right">
            {Boolean(selectedTransaction?.txHash) && (
              <MenuItem icon="search" onClick={handleOpenInExplorer}>{lang('WalletViewInExplorer')}</MenuItem>
            )}
            <MenuItem icon="help" onClick={handleOpenHowItWorks}>{lang('WalletWhatIsGram')}</MenuItem>
          </DropdownMenu>
        </ModalHeaderAction>
      )}
    </ModalHeader>
  );

  function renderScreen(isActive: boolean, isFrom: boolean, key: WalletScreen) {
    return (
      <WalletSlide
        isRoot={key === rootScreen}
        ref={key === WalletScreen.Main ? mainSlideRef : undefined}
        className={buildClassName(styles.slide, 'custom-scroll', ACCENT_SCREENS.has(key) && styles.slideAccent)}
        contentClassName={styles.slideContent}
        onBack={handleBack}
        onScroll={handleSlideScroll}
      >
        {renderScreenContent(key, isActive)}
      </WalletSlide>
    );
  }

  function renderScreenContent(key: WalletScreen, isActive: boolean) {
    switch (key) {
      case WalletScreen.Receive:
        return <WalletReceiveScreen address={address!} onBuyClick={handleOpenBuy} />;
      case WalletScreen.Buy:
        return (
          <WalletBuyScreen onCurrencyClick={handleOpenCurrency} onProviderSelect={handleProviderSelect} />
        );
      case WalletScreen.BuyAmount:
        return <WalletBuyAmountScreen />;
      case WalletScreen.Currency:
        return <WalletCurrencyScreen onSelect={handleBack} />;
      case WalletScreen.Send:
        return (
          <WalletSendScreen
            draft={sendDraft}
            collectible={sendCollectible}
            onSubmit={handleSendSubmit}
            onDraftChange={setSendDraft}
            onBuy={handleOpenBuy}
          />
        );
      case WalletScreen.Transaction:
        return selectedTransaction ? (
          <WalletTransactionScreen
            transaction={selectedTransaction}
            isRoot={isTransactionRoot}
            onDecryptComment={handleDecryptComment}
            onSend={address ? handleSendTo : undefined}
            onDone={handleTransactionDone}
          />
        ) : (
          <div className={styles.loading}>
            <Spinner />
          </div>
        );
      case WalletScreen.Collectible:
        // The list can be refreshed from under the screen
        return selectedCollectible ? (
          <WalletCollectibleScreen
            collectible={selectedCollectible}
            onTransfer={handleOpenCollectibleTransfer}
            onDone={handleBack}
          />
        ) : (
          <div className={styles.loading}>
            <Spinner />
          </div>
        );
      case WalletScreen.Password: {
        const { flow } = credentials;
        const errorKey = flow?.error ? WALLET_ERROR_LANG_KEYS[flow.error] : undefined;

        return (
          <WalletPasswordScreen
            isActive={isActive}
            isLoading={flow?.status === 'pending'}
            error={errorKey ? lang(errorKey) : undefined}
            onSubmit={credentials.handlePasswordSubmit}
            onClearError={credentials.handlePasswordErrorClear}
          />
        );
      }
      case WalletScreen.Passcode: {
        const { flow } = credentials;
        const errorKey = flow?.status === 'error' && flow.error ? WALLET_ERROR_LANG_KEYS[flow.error] : undefined;

        return (
          <WalletPasswordScreen
            isActive={isActive}
            isPasscode
            isLoading={flow?.status === 'pending'}
            error={errorKey ? lang(errorKey) : undefined}
            onSubmit={credentials.handlePasscodeSubmit}
            onClearError={credentials.handlePasswordErrorClear}
          />
        );
      }
      case WalletScreen.PasscodeRequired:
        return <WalletPasscodeRequiredScreen onSetUp={handleOpenPasscodeSettings} />;
      case WalletScreen.ReleaseKey:
        return <WalletReleaseKeyScreen onRemove={handleReleaseKeyRemove} />;
      case WalletScreen.Settings:
        return (
          <WalletSettingsScreen
            onConnectedAppsClick={handleOpenConnectedApps}
            onCurrencyClick={handleOpenCurrency}
            onPasscodeClick={handleOpenPasscodeSettings}
            onHowItWorksClick={handleOpenHowItWorks}
            onShowPhrase={keysFlows.handleShowPhrase}
            onEnableBackup={keysFlows.handleEnableBackup}
            onDisableBackup={keysFlows.handleDisableBackup}
            onDeleteWallet={keysFlows.handleDeleteWallet}
            onImportSavedWallet={keysFlows.handleImportSavedWallet}
            onShowSavedPhrase={keysFlows.handleShowSavedPhrase}
            onEnterOwnPhrase={keysFlows.handleImportOwnWallet}
          />
        );
      case WalletScreen.HowItWorks:
        return <WalletHowItWorksScreen onDone={handleBack} />;
      case WalletScreen.Intro:
        return <WalletIntroScreen onDone={handleIntroDone} />;
      case WalletScreen.ConnectedApps:
        return (
          <WalletConnectedAppsScreen onOpen={handleOpenConnectedApp} onDisconnectAll={handleTonConnectDisconnectAll} />
        );
      case WalletScreen.ConnectedApp:
        // The list can be refreshed from under the screen
        return selectedSession ? (
          <WalletConnectedAppScreen
            session={selectedSession}
            isBusy={walletTonConnect?.status === 'pending' || walletTonConnect?.status === 'done'}
            error={walletTonConnect?.error ? lang(WALLET_ERROR_LANG_KEYS[walletTonConnect.error]) : undefined}
            onDisconnect={handleTonConnectDisconnect}
          />
        ) : (
          <div className={styles.loading}>
            <Spinner />
          </div>
        );
      case WalletScreen.TonConnect:
        return walletTonConnect?.oauth ? (
          <WalletTonConnectLoginScreen
            flow={walletTonConnect}
            onConfirm={handleTonConnectConfirm}
            onDecline={handleTonConnectDecline}
          />
        ) : (
          <WalletTonConnectScreen
            flow={walletTonConnect}
            onUnlock={handleTonConnectUnlock}
            onConfirm={handleTonConnectConfirm}
            onDecline={handleTonConnectDecline}
          />
        );
      case WalletScreen.EnterPhrase: {
        const isImport = Boolean(pendingReplace);
        const isOwnExpected = isOwnPhraseExpected;
        const phraseFlow = isImport ? walletReplace : walletBackup;
        const errorKey = phraseFlow?.status === 'error' && phraseFlow.error
          ? WALLET_ERROR_LANG_KEYS[phraseFlow.error]
          : undefined;

        return (
          <WalletEnterPhraseScreen
            title={isOwnExpected ? lang('WalletSecretPhraseTitle') : undefined}
            subtitle={enterPhraseSubtitle}
            initialWords={isImport ? pendingReplace?.words : undefined}
            isLoading={keysFlows.isPhraseValidating || phraseFlow?.status === 'pending'}
            error={keysFlows.phraseError ? lang(keysFlows.phraseError) : errorKey ? lang(errorKey) : undefined}
            onSubmit={keysFlows.handleEnterPhraseSubmit}
            onClearError={keysFlows.handleEnterPhraseErrorClear}
          />
        );
      }
      case WalletScreen.DisableBackup:
        return (
          <WalletDisableBackupScreen
            isLoading={walletBackup?.status === 'pending'}
            onConfirm={keysFlows.handleConfirmDisableBackup}
          />
        );
      case WalletScreen.DeleteWallet:
        return (
          <WalletDeleteScreen
            canSave={canExportPhrase}
            switchToAddress={pendingReplace?.savedAddress}
            onConfirm={keysFlows.handleDeleteConfirm}
          />
        );
      case WalletScreen.ReplaceWallet:
        return (
          <WalletReplaceScreen onCreate={keysFlows.handleReplaceCreate} onImport={keysFlows.handleReplaceImport} />
        );
      case WalletScreen.PhraseInfo:
        return (
          <WalletPhraseInfoScreen
            isLoading={walletMnemonic?.status === 'pending'}
            onShow={keysFlows.handlePhraseInfoShow}
          />
        );
      case WalletScreen.Phrase:
        return <WalletPhraseScreen mnemonic={walletMnemonic?.words} onDone={keysFlows.handlePhraseDone} />;
      default:
        return (
          <WalletMainScreen
            activeTab={activeTab}
            scrollContainerRef={mainSlideRef}
            onProtect={keysFlows.handleEnableBackup}
            onProtectAccount={handleProtectAccount}
            onOpenSettings={handleOpenSettings}
            onOpenEarnings={handleOpenEarnings}
            onReceive={handleOpenReceive}
            onSend={handleOpenSend}
            onSwitchTab={setActiveTab}
            onTransactionClick={handleOpenTransaction}
            onCollectibleClick={handleOpenCollectible}
          />
        );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      dialogClassName={styles.dialog}
      noContentInlinePadding
      noScrollable
      ariaLabel={lang(screenTitleKey || 'WalletTitle')}
      onClose={handleClose}
      onCloseAnimationEnd={handleCloseAnimationEnd}
      onEsc={stack.length > 1 ? handleBack : undefined}
    >
      <Transition
        name={transitionName}
        activeKey={screen}
        direction={direction}
        className={styles.transition}
      >
        {renderScreen}
      </Transition>
      <ConfirmDialog
        isOpen={isPhraseWhyOpen}
        text={lang('WalletSecretPhraseWhyText')}
        confirmLabel={lang('OK')}
        confirmHandler={closePhraseWhy}
        isOnlyConfirm
        onClose={closePhraseWhy}
      />
      {/* If the typed words open some other wallet, its address is shown so the user sees which phrase they typed */}
      <ConfirmDialog
        isOpen={Boolean(wrongPhrase)}
        title={lang('WalletWrongPhraseTitle')}
        text={lang('WalletWrongPhraseText')}
        confirmLabel={lang('OK')}
        confirmHandler={keysFlows.handleWrongPhraseClose}
        isOnlyConfirm
        onClose={keysFlows.handleWrongPhraseClose}
      >
        {wrongPhraseGroups && (
          <div className={styles.wrongPhraseAddress}>
            {wrongPhraseGroups.map((group, index) => (
              <span key={index} className={index % 2 ? styles.wrongPhraseGroupMuted : undefined}>
                {group}
                {getAddressGroupSeparator(index, wrongPhraseGroups.length)}
              </span>
            ))}
          </div>
        )}
      </ConfirmDialog>
    </Modal>
  );
};

function HeaderMenuButton({ isOpen, onTrigger }: { isOpen?: boolean; onTrigger: NoneToVoidFunction }) {
  const lang = useLang();

  return (
    <Button
      round
      color="translucent"
      size="tiny"
      className={buildClassName(styles.headerButton, isOpen && 'active')}
      ariaLabel={lang('AccDescrMoreOptions')}
      onClick={onTrigger}
    >
      <Icon name="more" />
    </Button>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);

    return {
      canExportPhrase: selectCanExportWalletPhrase(global),
      isKeyMissing: selectIsWalletKeyMissing(global),
      hasLocalSecret: global.wallet?.hasLocalSecret,
      hasAppPasscode: global.passcode.hasPasscode,
      address: selectWalletAddress(global),
      publicKey: selectWalletPublicKey(global),
      tonExplorerUrl: selectTonExplorerUrl(global),
      transactions: global.wallet?.transactions,
      loadedTransactions: global.wallet?.loadedTransactions,
      collectibles: global.wallet?.collectibles,
      walletTransfer: tabState.walletTransfer,
      walletMnemonic: tabState.walletMnemonic,
      walletBackup: tabState.walletBackup,
      walletReplace: tabState.walletReplace,
      walletCommentDecryption: tabState.walletCommentDecryption,
      walletTonConnect: tabState.walletTonConnect,
      tonConnectSessions: global.wallet?.tonConnectSessions,
      decryptedComments: global.wallet?.decryptedComments,
      animationLevel: selectSharedSettings(global).animationLevel,
    };
  },
)(WalletModal));
