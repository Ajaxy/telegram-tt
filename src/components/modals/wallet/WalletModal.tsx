import {
  memo, onFullyIdle, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiTonConnectSession, ApiWalletCollectible, ApiWalletTransaction } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { AnimationLevel } from '../../../types';
import type { RegularLangKey } from '../../../types/language';
import { SettingsScreens } from '../../../types';
import { WalletScreen } from './types';

import { TON_CURRENCY_CODE, WALLET_FIRST_TRANSFER_SUGGESTION } from '../../../config';
import { getIsWalletTransferSubmitted, WALLET_ERROR_LANG_KEYS } from '../../../global/helpers';
import {
  selectCanExportWalletPhrase, selectIsWalletKeyMissing, selectShouldLoopStickers, selectTabState,
  selectTonExplorerUrl, selectWalletAddress, selectWalletPublicKey, selectWalletTransactions,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import { formatTonShortFromNanos } from '../../../util/formatCurrency';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { getAddressGroupSeparator, splitAddressIntoGroups } from '../../../util/tonAddress';
import useWalletCredentials from './useWalletCredentials';
import useWalletKeyFlows from './useWalletKeyFlows';
import useWalletNavigation from './useWalletNavigation';
import useWalletSendFlow from './useWalletSendFlow';

import useInterval from '../../../hooks/schedulers/useInterval';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import GramIcon from '../../common/icons/GramIcon';
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
import WalletHowItWorksModal from './WalletHowItWorksModal';
import WalletIntroScreen from './WalletIntroScreen';
import WalletMainScreen, { TRANSACTIONS_TAB_INDEX } from './WalletMainScreen';
import WalletPasscodeRequiredScreen from './WalletPasscodeRequiredScreen';
import WalletPasswordScreen from './WalletPasswordScreen';
import WalletPhraseInfoScreen from './WalletPhraseInfoScreen';
import WalletPhraseScreen from './WalletPhraseScreen';
import WalletReceiveScreen from './WalletReceiveScreen';
import WalletReleaseKeyScreen from './WalletReleaseKeyScreen';
import WalletReplaceScreen from './WalletReplaceScreen';
import WalletSendAmountScreen from './WalletSendAmountScreen';
import WalletSendFlight from './WalletSendFlight';
import WalletSendRecipientScreen from './WalletSendRecipientScreen';
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
  balance?: bigint;
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
  [WalletScreen.SendAmount]: 'WalletSendTitle',
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
  modal, canExportPhrase, isKeyMissing, hasLocalSecret, hasAppPasscode, address, publicKey, balance, tonExplorerUrl,
  transactions, loadedTransactions, collectibles, walletTransfer, walletMnemonic, walletBackup, walletReplace,
  walletCommentDecryption, walletTonConnect, tonConnectSessions, decryptedComments, animationLevel,
}: OwnProps & StateProps) => {
  const {
    openWalletModal, closeWalletModal, loadWalletState, loadWalletTransactions,
    loadWalletBuyContext, clearWalletBuy, decryptWalletComment,
    clearWalletCommentDecryption, dropWalletVaultSecrets, openSettingsScreen, openUrl,
    watchWalletActivity, unwatchWalletActivity, openStarsBalanceModal, loadWalletCollectibles,
    unlockWalletTonConnectRequest, respondWalletTonConnect, connectWalletTonConnectOauth, disconnectWalletTonConnect,
    clearWalletTonConnect, closeUrlAuthModal,
    disconnectAllWalletTonConnect, dismissWalletIntro, dismissSuggestion,
  } = getActions();

  const lang = useLang();

  // The diamonds share one model; it is fetched while the user looks at the balance, before any screen draws one
  useEffectOnce(() => {
    onFullyIdle(() => {
      if (!selectShouldLoopStickers(getGlobal())) return;

      void import('../../../lib/diamond/model').then(({ loadModel }) => loadModel()).catch(() => undefined);
    });
  });

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
  const [isHowItWorksOpen, openHowItWorks, closeHowItWorks] = useFlag();

  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>();
  const [selectedCollectibleAddress, setSelectedCollectibleAddress] = useState<string | undefined>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState(0);

  const [isSendFlightReady, setIsSendFlightReady] = useState(false);

  // The collectibles tab hides the row the diamond lands in
  const handleSendFlightStart = useLastCallback(() => {
    setActiveTab(TRANSACTIONS_TAB_INDEX);
  });

  const sendFlow = useWalletSendFlow({
    modal,
    navigation,
    credentials,
    isKeyMissing,
    address,
    balance,
    collectibles,
    walletTransfer,
    isFlightReady: isSendFlightReady,
    onKeyMissing: handleImportOwnWallet,
    onFlightStart: handleSendFlightStart,
  });
  const { draft: sendDraft, isSendScreen } = sendFlow;

  const isOpen = Boolean(modal);

  // Names the screen whose slide is scrolled, so a screen that opens fresh starts without the header edge
  const [scrolledScreen, setScrolledScreen] = useState<WalletScreen | undefined>();
  const isScrolled = scrolledScreen === screen;
  const handleSlideScrolledChange = useLastCallback((isSlideScrolled: boolean) => {
    setScrolledScreen(isSlideScrolled ? screen : undefined);
  });

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

    if (initialTransactionId) setSelectedTransactionId(initialTransactionRecordId);
  }, [shouldReleaseKey, initialTransactionId, initialTransactionRecordId, push]);

  const handleCloseAnimationEnd = useLastCallback(() => {
    reset();
    credentials.reset();
    keysFlows.reset();
    closePhraseWhy();
    setSelectedTransactionId(undefined);
    setSelectedCollectibleAddress(undefined);
    setSelectedSessionId(undefined);
    sendFlow.reset();
    setActiveTab(0);
    clearWalletBuy();

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

  // Opened from a wallet card, the form has only the main screen below it, and the user did not come from there
  const shouldBackClose = Boolean(modal?.shouldCloseOnBack && stack.length === 2);

  const handleBack = useLastCallback(() => {
    if (isRequestPending) return;

    if (shouldBackClose) {
      closeWalletModal();
      return;
    }

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

    sendFlow.handleBack();
    back();
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
    openStarsBalanceModal({ currency: TON_CURRENCY_CODE, shouldReturnToWallet: true });
  });

  const handleOpenPasscodeSettings = useLastCallback(() => {
    openSettingsScreen({ screen: hasAppPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled });
    closeWalletModal();
  });

  const handleReleaseKeyRemove = useLastCallback(() => {
    dropWalletVaultSecrets();
  });

  // A sent transfer is listed under its message hash until the chain confirms it under its own id
  const selectedTransaction = useMemo(() => {
    if (!selectedTransactionId) return undefined;

    const isSelected = ({ id, msgHash, localId }: ApiWalletTransaction) => (
      id === selectedTransactionId || msgHash === selectedTransactionId || localId === selectedTransactionId
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

  const headerBalanceRef = useRef<HTMLButtonElement>();
  const [headerBalanceWidth, setHeaderBalanceWidth] = useState(0);

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
    setSelectedTransactionId(transaction.localId ?? transaction.id);
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

  const screenTitleKey = isSendScreen && sendDraft.collectibleAddress
    ? 'WalletSendCollectibleTitle' : SCREEN_TITLE_KEYS[screen];
  const transitionName = resolveTransitionName('layers', animationLevel, isInstant);

  const hasHeaderBalance = screen === WalletScreen.SendAmount && !sendDraft.collectibleAddress && balance !== undefined;
  const isSendSubmitted = getIsWalletTransferSubmitted(walletTransfer);
  useResizeObserver(headerBalanceRef, (entry) => {
    setHeaderBalanceWidth(entry.borderBoxSize[0].inlineSize);
  }, !hasHeaderBalance);

  const header = (
    <ModalHeader
      className={buildClassName(
        styles.header,
        ACCENT_SCREENS.has(screen) && styles.headerOnAccent,
        screen === WalletScreen.SendAmount && styles.headerOnSurface,
        isScrolled && !ACCENT_SCREENS.has(screen) && styles.headerScrolled,
      )}
      noMask
    >
      <ModalCloseButton
        className={styles.headerButton}
        onBack={stack.length > 1 && !shouldBackClose ? handleBack : undefined}
      />
      <ModalTitle>
        <div
          className={buildClassName(
            styles.headerTitleBox,
            // The balance is measured after its first frame, and the title would cover it there
            hasHeaderBalance && !headerBalanceWidth && styles.headerTitleBoxUnmeasured,
          )}
          style={hasHeaderBalance ? `--header-action-width: ${headerBalanceWidth}px` : undefined}
        >
          <Transition
            name={isInstant ? 'none' : 'slideVerticalFade'}
            // Both send screens have the same title, which must not slide out and back in
            activeKey={isSendScreen ? WalletScreen.Send : screen}
            direction={direction}
            className={styles.headerTitle}
          >
            {screenTitleKey ? <span className={styles.headerTitleText}>{lang(screenTitleKey)}</span> : ' '}
          </Transition>
        </div>
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
      {hasHeaderBalance && (
        <ModalHeaderAction>
          <button
            ref={headerBalanceRef}
            type="button"
            className={styles.headerBalance}
            title={lang('WalletSendMax')}
            onClick={isSendSubmitted ? undefined : sendFlow.handleSendMax}
          >
            <span className={styles.headerBalanceLabel}>{lang('StarsBalance')}</span>
            <span className={styles.headerBalanceAmount}>
              <GramIcon />
              {formatTonShortFromNanos(balance)}
            </span>
          </button>
        </ModalHeaderAction>
      )}
      {screen === WalletScreen.Transaction && (
        <ModalHeaderAction>
          <DropdownMenu className={styles.headerMenu} trigger={HeaderMenuButton} positionX="right">
            {Boolean(selectedTransaction?.txHash) && (
              <MenuItem icon="search" onClick={handleOpenInExplorer}>{lang('WalletViewInExplorer')}</MenuItem>
            )}
            <MenuItem icon="help" onClick={openHowItWorks}>{lang('WalletWhatIsGram')}</MenuItem>
          </DropdownMenu>
        </ModalHeaderAction>
      )}
    </ModalHeader>
  );

  function renderScreen(isActive: boolean, isFrom: boolean, key: WalletScreen) {
    return (
      <WalletSlide
        isRoot={key === rootScreen}
        isActive={isActive}
        className={buildClassName(
          styles.slide,
          'custom-scroll',
          ACCENT_SCREENS.has(key) && styles.slideAccent,
          key === WalletScreen.SendAmount && styles.slideSurface,
        )}
        contentClassName={styles.slideContent}
        onBack={handleBack}
        onScrolledChange={handleSlideScrolledChange}
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
          <WalletSendRecipientScreen
            isActive={isActive}
            draft={sendDraft}
            onDraftChange={sendFlow.setDraft}
            onContinue={sendFlow.handleRecipientContinue}
          />
        );
      case WalletScreen.SendAmount:
        return (
          <WalletSendAmountScreen
            isActive={isActive}
            draft={sendDraft}
            collectible={sendFlow.collectible}
            onSubmit={sendFlow.handleSubmit}
            onDraftChange={sendFlow.setDraft}
            onBuy={handleOpenBuy}
          />
        );
      case WalletScreen.Transaction:
        return selectedTransaction ? (
          <WalletTransactionScreen
            transaction={selectedTransaction}
            isRoot={isTransactionRoot}
            onDecryptComment={handleDecryptComment}
            onSend={address ? sendFlow.handleSendTo : undefined}
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
            onTransfer={sendFlow.handleOpenCollectibleTransfer}
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
            onHowItWorksClick={openHowItWorks}
            onShowPhrase={keysFlows.handleShowPhrase}
            onEnableBackup={keysFlows.handleEnableBackup}
            onDisableBackup={keysFlows.handleDisableBackup}
            onDeleteWallet={keysFlows.handleDeleteWallet}
            onImportSavedWallet={keysFlows.handleImportSavedWallet}
            onShowSavedPhrase={keysFlows.handleShowSavedPhrase}
            onEnterOwnPhrase={keysFlows.handleImportOwnWallet}
          />
        );
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
            scrollContainerClosest={`.${styles.slide}`}
            onProtect={keysFlows.handleEnableBackup}
            onProtectAccount={handleProtectAccount}
            onOpenSettings={handleOpenSettings}
            onOpenEarnings={handleOpenEarnings}
            onReceive={handleOpenReceive}
            onSend={sendFlow.handleOpenSend}
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
      <WalletSendFlight canLaunch={screen === WalletScreen.SendAmount} onReadyChange={setIsSendFlightReady} />
      <WalletHowItWorksModal isOpen={isHowItWorksOpen} onClose={closeHowItWorks} />
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
      balance: global.wallet?.state?.balance,
      tonExplorerUrl: selectTonExplorerUrl(global),
      transactions: selectWalletTransactions(global),
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
