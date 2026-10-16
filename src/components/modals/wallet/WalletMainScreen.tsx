import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiUser, ApiWalletCollectible, ApiWalletSavedWallet, ApiWalletStatus, ApiWalletTransaction,
} from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';
import {
  selectUser, selectWalletAddress, selectWalletCurrency, selectWalletCurrencyRate,
} from '../../../global/selectors';
import { formatTonShortFromNanos } from '../../../util/formatCurrency';
import { formatTonAsIcon, formatTonTextFromNanos } from '../../../util/localization/format';

import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import WalletCard from './WalletCard';
import WalletCollectibleItem from './WalletCollectibleItem';
import WalletFeatures from './WalletFeatures';
import WalletTransactionItem from './WalletTransactionItem';
import Control, { ControlAfter, ControlBefore, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription } from '@gili/layout/Island';

import styles from './WalletMainScreen.module.scss';

type OwnProps = {
  activeTab: number;
  scrollContainerRef: ElementRef<HTMLDivElement>;
  onProtect: NoneToVoidFunction;
  onProtectAccount: NoneToVoidFunction;
  onOpenSettings: NoneToVoidFunction;
  onOpenEarnings: NoneToVoidFunction;
  onReceive: NoneToVoidFunction;
  onSend: NoneToVoidFunction;
  onSwitchTab: (index: number) => void;
  onTransactionClick: (transaction: ApiWalletTransaction) => void;
  onCollectibleClick: (collectible: ApiWalletCollectible) => void;
};

type StateProps = {
  status?: ApiWalletStatus;
  hasStateError?: boolean;
  canEnableBackup?: boolean;
  hasCloudPassword?: boolean;
  address?: string;
  currentUser?: ApiUser;
  balance?: bigint;
  tonUsdRate?: number;
  currency: string;
  currencyRate?: number;
  transactions?: ApiWalletTransaction[];
  transferMinNanos?: bigint;
  collectibles?: ApiWalletCollectible[];
  hasMoreTransactions?: boolean;
  hasMoreCollectibles?: boolean;
  usersById: Record<string, ApiUser>;
  existingWaltBalanceUrl?: string;
  savedWallets?: ApiWalletSavedWallet[];
  earningsNanos?: bigint;
};

const COLLECTIBLES_TAB_INDEX = 1;
// Nanotons. Above it the screen suggests a cloud password and banners money kept elsewhere.
const NOTABLE_BALANCE_NANOS = 500_000_000n;

const FRAGMENT_GIFTS_URL = 'https://fragment.com/gifts';
// A percentage in `rootMargin` is relative to the scroll container, so the next page loads one screen early
const HISTORY_PRELOAD_MARGIN = '100%';

const WalletMainScreen = ({
  activeTab, scrollContainerRef,
  status, hasStateError, canEnableBackup, hasCloudPassword, address, currentUser, balance, tonUsdRate, currency,
  currencyRate,
  transactions, transferMinNanos, collectibles, hasMoreTransactions, hasMoreCollectibles, usersById,
  existingWaltBalanceUrl, savedWallets, earningsNanos,
  onProtect, onProtectAccount, onOpenSettings, onOpenEarnings, onReceive, onSend, onSwitchTab,
  onTransactionClick, onCollectibleClick,
}: OwnProps & StateProps) => {
  const {
    openUrl, loadWalletTransactions, loadWalletCollectibles, loadWalletState, closeWalletModal,
  } = getActions();

  const lang = useLang();

  const historyEndRef = useRef<HTMLDivElement>();

  const isCollectiblesTab = activeTab === COLLECTIBLES_TAB_INDEX;
  const shouldProtectAccount = hasCloudPassword === false && (balance ?? 0n) > NOTABLE_BALANCE_NANOS;
  const oldWalletsNanos = useMemo(
    () => savedWallets?.reduce((sum, wallet) => sum + (wallet.balance ?? 0n), 0n) ?? 0n,
    [savedWallets],
  );
  const hasOldWalletsFunds = oldWalletsNanos > NOTABLE_BALANCE_NANOS;
  const hasEarnings = (earningsNanos ?? 0n) > NOTABLE_BALANCE_NANOS;
  const hasHistory = Boolean(isCollectiblesTab ? collectibles?.length : transactions?.length);
  const hasMoreHistory = isCollectiblesTab ? hasMoreCollectibles : hasMoreTransactions;

  const { observe: observeHistoryEnd } = useIntersectionObserver({
    rootRef: scrollContainerRef,
    margin: HISTORY_PRELOAD_MARGIN,
  });

  // An empty tab must not request more pages even if its cursor is stale
  const shouldObserveHistoryEnd = hasHistory && hasMoreHistory;

  useOnIntersect(historyEndRef, shouldObserveHistoryEnd ? observeHistoryEnd : undefined, ({ isIntersecting }) => {
    if (!isIntersecting) return;

    if (isCollectiblesTab) {
      loadWalletCollectibles();
    } else {
      loadWalletTransactions();
    }
  });

  const historyTabs = useMemo(() => ([
    { title: lang('WalletTabTransactions') },
    { title: lang('WalletTabCollectibles') },
  ]), [lang]);

  // Collectibles load with the screen rather than with their tab, and again after the address changes
  useEffect(() => {
    if (!address || collectibles) return;

    loadWalletCollectibles({ shouldRefresh: true });
  }, [address, collectibles]);

  const handleOpenFragment = useLastCallback(() => {
    openUrl({ url: FRAGMENT_GIFTS_URL });
  });

  const handleRetryState = useLastCallback(() => {
    loadWalletState();
  });

  // The link leads to the former wallet bot, where the user leaves this wallet
  const handleOpenWalt = useLastCallback(() => {
    closeWalletModal();
    openUrl({ url: existingWaltBalanceUrl! });
  });

  // A failed request before any status is known offers a retry instead of the spinner
  if (!address) {
    const isStateFailed = !status && hasStateError;
    const noticeKey = status === 'unavailable' ? 'WalletUnavailable'
      : isStateFailed ? 'WalletLoadError' : 'WalletProvisioning';

    return (
      <div className={styles.root}>
        <WalletFeatures className={styles.features} />
        <div className={styles.provisioning}>
          {status !== 'unavailable' && !isStateFailed && <Spinner color="blue" />}
          {lang(noticeKey)}
          {isStateFailed && (
            <Button isText pill onClick={handleRetryState}>{lang('Retry')}</Button>
          )}
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className={styles.transactions}>
        <Island className={styles.history}>
          <TabList
            tabs={historyTabs}
            activeTab={activeTab}
            className={styles.historyTabs}
            centered
            onSwitchTab={onSwitchTab}
          />
          {isCollectiblesTab
            ? (
              <Transition
                name="fade"
                activeKey={collectibles?.length ? 1 : 0}
                shouldCleanup
                className={styles.tabContent}
              >
                {collectibles?.length ? collectibles.map((collectible) => (
                  <WalletCollectibleItem
                    key={collectible.address}
                    collectible={collectible}
                    onClick={onCollectibleClick}
                  />
                )) : renderNoCollectibles()}
              </Transition>
            )
            : (
              <Transition
                name="fade"
                activeKey={transactions?.length ? 1 : 0}
                shouldCleanup
                className={styles.tabContent}
              >
                {transactions?.length ? transactions.map((transaction) => (
                  <WalletTransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    user={transaction.peer.type === 'user' ? usersById[transaction.peer.userId] : undefined}
                    onClick={onTransactionClick}
                  />
                )) : <WalletFeatures className={styles.features} />}
              </Transition>
            )}
          <div ref={historyEndRef} />
        </Island>
        {!isCollectiblesTab && Boolean(transactions?.length && transferMinNanos) && (
          <IslandDescription>
            {lang('WalletTransactionsHidden', { amount: formatTonTextFromNanos(lang, transferMinNanos!, true) })}
          </IslandDescription>
        )}
      </div>
    );
  }

  function formatGramAmount(nanos: bigint) {
    return formatTonAsIcon(lang, formatTonShortFromNanos(nanos));
  }

  function renderBanner(label: TeactNode, onClick: NoneToVoidFunction) {
    return (
      <Interactive clickable ripple onClick={onClick}>
        <Control>
          <ControlLabel>{label}</ControlLabel>
          <ControlAfter>
            <Icon name="next" className={styles.waltChevron} />
          </ControlAfter>
        </Control>
      </Interactive>
    );
  }

  function renderNoCollectibles() {
    return (
      <div className={styles.noCollectibles}>
        <div className={styles.noCollectiblesSticker}>🎁</div>
        <div className={styles.noCollectiblesText}>{lang('WalletNoCollectibles')}</div>
        <Button isText pill color="translucent" onClick={handleOpenFragment}>
          {lang('WalletNoCollectiblesAction')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {(existingWaltBalanceUrl || hasOldWalletsFunds || hasEarnings) && (
        <Island className={styles.walt}>
          {existingWaltBalanceUrl && renderBanner(lang('WalletExistingWaltBalance'), handleOpenWalt)}
          {hasOldWalletsFunds && renderBanner(
            lang('WalletAlsoHaveOldWallets', { amount: formatGramAmount(oldWalletsNanos) }, { withNodes: true }),
            onOpenSettings,
          )}
          {hasEarnings && renderBanner(
            lang('WalletAlsoHaveEarnings', { amount: formatGramAmount(earningsNanos!) }, { withNodes: true }),
            onOpenEarnings,
          )}
        </Island>
      )}
      <WalletCard
        address={address}
        ownerName={getUserFullName(lang, currentUser)}
        balance={balance}
        usdRate={tonUsdRate}
        currency={currency}
        currencyRate={currencyRate}
        onQrClick={onReceive}
      />
      <div className={styles.buttons}>
        <Button className={styles.actionButton} pill fluid onClick={onReceive}>{lang('WalletAddFunds')}</Button>
        <Button className={styles.actionButton} pill fluid onClick={onSend}>
          {lang('WalletSend')}
        </Button>
      </div>
      {shouldProtectAccount && (
        <Island className={styles.protect}>
          <Interactive clickable ripple onClick={onProtectAccount}>
            <Control>
              <ControlBefore className={styles.protectIcon}>
                <Icon name="lock-filled" className={styles.protectGlyph} />
              </ControlBefore>
              <ControlLabel className={styles.protectLabel}>{lang('WalletProtectAccountBanner')}</ControlLabel>
            </Control>
          </Interactive>
        </Island>
      )}
      {canEnableBackup && (
        <Island className={styles.protect}>
          <Interactive clickable ripple onClick={onProtect}>
            <Control>
              <ControlBefore className={styles.protectIcon}>
                <Icon name="warning-filled" className={styles.protectGlyph} />
              </ControlBefore>
              <ControlLabel className={styles.protectLabel}>{lang('WalletProtectBanner')}</ControlLabel>
            </Control>
          </Interactive>
        </Island>
      )}
      <div className={styles.section}>{renderHistory()}</div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;

    return {
      status: global.wallet?.status,
      hasStateError: global.wallet?.hasStateError,
      canEnableBackup: global.wallet?.state?.canEnableBackup,
      hasCloudPassword: global.settings.byKey.hasPassword,
      address: selectWalletAddress(global),
      currentUser,
      balance: global.wallet?.state?.balance,
      tonUsdRate: global.appConfig.tonUsdRate,
      currency: selectWalletCurrency(global),
      currencyRate: selectWalletCurrencyRate(global),
      transactions: global.wallet?.transactions,
      transferMinNanos: global.appConfig.walletTransferMinNanos,
      collectibles: global.wallet?.collectibles,
      hasMoreTransactions: global.wallet?.nextOffset !== undefined,
      hasMoreCollectibles: global.wallet?.collectiblesNextOffset !== undefined,
      usersById: global.users.byId,
      existingWaltBalanceUrl: global.wallet?.existingWaltBalanceUrl,
      savedWallets: global.wallet?.savedWallets,
      earningsNanos: global.ton?.balance.amount,
    };
  },
)(WalletMainScreen));
