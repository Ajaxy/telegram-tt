import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiUser, ApiWalletCollectible, ApiWalletSavedWallet, ApiWalletStatus, ApiWalletTransaction,
} from '../../../api/types';
import type { WalletCardLayout } from '../../../global/helpers/wallet';
import type { ThemeKey } from '../../../types';
import type { CardEditorRef } from './helpers/cardEditing';

import { getUserFullName } from '../../../global/helpers';
import { filterUnsentCollectibles } from '../../../global/helpers/wallet';
import {
  selectCanAnimateInterface, selectCanEditOwnWalletCard, selectOwnWalletCardDecoration, selectTheme, selectUser,
  selectWalletAddress, selectWalletCurrency, selectWalletCurrencyRate, selectWalletTransactions,
} from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { buildCollectionByKey } from '../../../util/iteratees';
import { formatTonAsIcon, formatTonNumber, formatTonTextFromNanos } from '../../../util/localization/format';
import { WALLET_COLLECTIBLES_LIMIT, WALLET_TRANSACTIONS_LIMIT } from '../../../limits';
import { getCanColorCard, getIsStickerOnCard } from './helpers/cardEditing';
import { getStickerPose } from './helpers/cardStickers';
import { getWalletCardStyle } from './helpers/cardStyleWave';
import useCardButtonsColor from './useCardButtonsColor';
import useCardStyleWave from './useCardStyleWave';
import useWalletCardEditor from './useWalletCardEditor';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import Spinner from '../../ui/Spinner';
import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import WalletCard from './WalletCard';
import WalletCardEditorOverlay from './WalletCardEditorOverlay';
import WalletCollectibleTile from './WalletCollectibleTile';
import WalletFeatures from './WalletFeatures';
import WalletTransactionItem from './WalletTransactionItem';
import Control, { ControlAfter, ControlBefore, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription } from '@gili/layout/Island';

import styles from './WalletMainScreen.module.scss';

type OwnProps = {
  activeTab: number;
  scrollContainerClosest: string;
  cardEditorRef: CardEditorRef;
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
  cardDecoration?: WalletCardLayout;
  canEditCard?: boolean;
  isCardEdited?: boolean;
  cardBackgroundCollections?: string[];
  canAnimate?: boolean;
  theme: ThemeKey;
  existingWaltBalanceUrl?: string;
  savedWallets?: ApiWalletSavedWallet[];
  earningsNanos?: bigint;
};

export const TRANSACTIONS_TAB_INDEX = 0;
export const COLLECTIBLES_TAB_INDEX = 1;
// Nanotons. Above it the screen suggests a cloud password and banners money kept elsewhere.
const NOTABLE_BALANCE_NANOS = 500_000_000n;

const HISTORY_ITEM_CLASS = 'WalletHistoryItem';

const WalletMainScreen = ({
  activeTab, scrollContainerClosest, cardEditorRef,
  status, hasStateError, canEnableBackup, hasCloudPassword, address, currentUser, balance, tonUsdRate, currency,
  currencyRate,
  transactions, transferMinNanos, collectibles, cardDecoration, isCardEdited, canEditCard, cardBackgroundCollections,
  canAnimate, theme,
  existingWaltBalanceUrl, savedWallets, earningsNanos,
  onProtect, onProtectAccount, onOpenSettings, onOpenEarnings, onReceive, onSend, onSwitchTab,
  onTransactionClick, onCollectibleClick,
}: OwnProps & StateProps) => {
  const {
    openUrl, loadWalletTransactions, loadWalletCollectibles, loadWalletState, closeWalletModal, loadFullUser,
  } = getActions();

  const lang = useLang();

  const faceRef = useRef<HTMLDivElement>();
  const foldRef = useRef<HTMLDivElement>();
  const gridRef = useRef<HTMLDivElement>();
  const editorLayerRef = useRef<HTMLDivElement>();
  const buttonsRef = useRef<HTMLDivElement>();
  const [dialogElement, setDialogElement] = useState<HTMLElement>();

  const shownCollectibles = useMemo(
    () => filterUnsentCollectibles(collectibles, transactions),
    [collectibles, transactions],
  );
  const hasCollectibles = Boolean(shownCollectibles?.length);
  const hasGifts = useMemo(() => shownCollectibles?.some(({ type }) => type === 'gift'), [shownCollectibles]);
  // As in the Android app, the collectibles tab exists only while there are collectibles
  const isCollectiblesTab = hasCollectibles && activeTab === COLLECTIBLES_TAB_INDEX;
  const shouldProtectAccount = hasCloudPassword === false && (balance ?? 0n) > NOTABLE_BALANCE_NANOS;
  const oldWalletsNanos = useMemo(
    () => savedWallets?.reduce((sum, wallet) => sum + (wallet.balance ?? 0n), 0n) ?? 0n,
    [savedWallets],
  );
  const hasOldWalletsFunds = oldWalletsNanos > NOTABLE_BALANCE_NANOS;
  const hasEarnings = (earningsNanos ?? 0n) > NOTABLE_BALANCE_NANOS;
  const transactionIds = useMemo(() => transactions?.map(({ id }) => id), [transactions]);
  const transactionsById = useMemo(() => transactions && buildCollectionByKey(transactions, 'id'), [transactions]);
  const collectibleAddresses = useMemo(
    () => shownCollectibles?.map((collectible) => collectible.address),
    [shownCollectibles],
  );
  const collectiblesByAddress = useMemo(
    () => shownCollectibles && buildCollectionByKey(shownCollectibles, 'address'),
    [shownCollectibles],
  );

  const editor = useWalletCardEditor({
    faceRef,
    foldRef,
    gridRef,
    decoration: cardDecoration,
    backgroundCollections: cardBackgroundCollections,
    cardEditorRef,
    isEnabled: Boolean(address && canEditCard),
    isFlat: !canAnimate,
  });

  const cardStyle = useMemo(
    () => getWalletCardStyle(cardDecoration?.stickers, cardDecoration?.backgroundAddress),
    [cardDecoration],
  );
  const stickerOrigins = useMemo(() => Object.fromEntries((cardDecoration?.stickers || []).map((sticker) => (
    [sticker.address, getStickerPose(sticker.coordinates)]
  ))), [cardDecoration]);
  const styleWave = useCardStyleWave({
    style: cardStyle,
    isEdited: isCardEdited,
    origins: stickerOrigins,
    heldAddresses: editor.uncontactedAddresses,
    faceRef,
    buttonsRef,
    isEnabled: canAnimate,
  });

  useCardButtonsColor({
    buttonsRef, faceRef, style: cardStyle, styleWave, themeKey: theme,
  });

  const handleLoadMoreTransactions = useLastCallback(() => {
    loadWalletTransactions();
  });

  const handleLoadMoreCollectibles = useLastCallback(() => {
    loadWalletCollectibles();
  });

  const [transactionViewportIds, getMoreTransactions] = useInfiniteScroll(
    handleLoadMoreTransactions, transactionIds, undefined, WALLET_TRANSACTIONS_LIMIT,
  );
  const [collectibleViewportIds, getMoreCollectibles] = useInfiniteScroll(
    handleLoadMoreCollectibles, collectibleAddresses, undefined, WALLET_COLLECTIBLES_LIMIT,
  );
  const hasHistory = isCollectiblesTab || Boolean(transactionViewportIds?.length);

  const historyTabs = useMemo(() => ([
    { title: lang('WalletTabTransactions') },
    { title: lang('WalletTabCollectibles') },
  ]), [lang]);

  const { ref: historyTabListRef, shouldRender: shouldRenderHistoryTabList } = useShowTransition({
    isOpen: hasCollectibles,
    noMountTransition: true,
    withShouldRender: true,
    className: false,
  });

  // As in the Android app, the last collectible leaving switches back to the transactions, so the highlight moves
  // there while the tabs fold, and new collectibles later do not swap the list under the user
  useEffect(() => {
    if (!hasCollectibles && activeTab === COLLECTIBLES_TAB_INDEX) onSwitchTab(TRANSACTIONS_TAB_INDEX);
  }, [hasCollectibles, activeTab, onSwitchTab]);

  useEffect(() => {
    setDialogElement(faceRef.current?.closest('dialog') || undefined);
  }, [address]);

  const getEditorLayer = useLastCallback(() => editorLayerRef.current);
  const getStickerMenuElement = useLastCallback(() => (
    editorLayerRef.current?.querySelector<HTMLElement>('.bubble')
  ));

  // The own card with its stickers comes with the profile, which names the card of the current wallet only
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (currentUserId && address) loadFullUser({ userId: currentUserId });
  }, [currentUserId, address]);

  // Collectibles load with the screen rather than with their tab, and again after the address changes
  useEffect(() => {
    if (!address || collectibles) return;

    loadWalletCollectibles({ shouldRefresh: true });
  }, [address, collectibles]);

  const handleRetryState = useLastCallback(() => {
    loadWalletState();
  });

  const handleTileClick = useLastCallback((collectible: ApiWalletCollectible) => {
    if (!editor.consumeTileClick()) onCollectibleClick(collectible);
  });

  // The closing menu keeps its items, while its choice already changes the card
  const menuCollectible = editor.menu?.collectible;
  const stickerMenu = useFrozenProps({
    anchor: editor.menu?.anchor,
    isOnCard: Boolean(menuCollectible && getIsStickerOnCard(cardDecoration, menuCollectible.address)),
    isColored: Boolean(menuCollectible && cardDecoration?.backgroundAddress === menuCollectible.address),
    canColor: Boolean(menuCollectible && getCanColorCard(menuCollectible.gift, cardBackgroundCollections)),
  }, !editor.menu);

  const handleAddToCard = useLastCallback(() => {
    editor.handleMenuAction();
  });

  const handleApplyColor = useLastCallback(() => {
    editor.handleMenuAction(true);
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
        {shouldRenderHistoryTabList && (
          <div ref={historyTabListRef} className={styles.historyTabListReveal}>
            <div className={styles.historyTabListClip}>
              <TabList
                tabs={historyTabs}
                activeTab={activeTab}
                className={styles.historyTabs}
                centered
                onSwitchTab={onSwitchTab}
              />
            </div>
          </div>
        )}
        {isCollectiblesTab ? (
          <InfiniteScroll
            ref={gridRef}
            className={styles.collectibles}
            items={collectibleViewportIds}
            itemSelector={`.${HISTORY_ITEM_CLASS}`}
            preloadBackwards={WALLET_COLLECTIBLES_LIMIT}
            scrollContainerClosest={scrollContainerClosest}
            noScrollRestoreOnTop
            onLoadMore={getMoreCollectibles}
          >
            {collectibleViewportIds?.map((collectibleAddress) => (
              <WalletCollectibleTile
                key={collectibleAddress}
                collectible={collectiblesByAddress![collectibleAddress]}
                isOnCard={getIsStickerOnCard(cardDecoration, collectibleAddress)
                  || editor.liftedAddresses.includes(collectibleAddress)}
                className={HISTORY_ITEM_CLASS}
                onPointerDown={editor.handleTilePointerDown}
                onContextMenu={editor.handleTileContextMenu}
                onClick={handleTileClick}
              />
            ))}
          </InfiniteScroll>
        ) : (
          <Island>
            <Transition
              name="fade"
              activeKey={transactionViewportIds?.length ? 1 : 0}
              shouldCleanup
              className={styles.tabContent}
            >
              {transactionViewportIds?.length ? (
                <InfiniteScroll
                  items={transactionViewportIds}
                  itemSelector={`.${HISTORY_ITEM_CLASS}`}
                  preloadBackwards={WALLET_TRANSACTIONS_LIMIT}
                  scrollContainerClosest={scrollContainerClosest}
                  noScrollRestoreOnTop
                  onLoadMore={getMoreTransactions}
                >
                  {transactionViewportIds.map((id) => {
                    const transaction = transactionsById![id];

                    return (
                      <WalletTransactionItem
                        key={transaction.localId ?? id}
                        transaction={transaction}
                        className={HISTORY_ITEM_CLASS}
                        onClick={onTransactionClick}
                      />
                    );
                  })}
                </InfiniteScroll>
              ) : <WalletFeatures className={styles.features} />}
            </Transition>
          </Island>
        )}
        {isCollectiblesTab && hasGifts && (IS_TOUCH_ENV || !cardDecoration?.stickers?.length) && (
          <IslandDescription>
            {lang(IS_TOUCH_ENV ? 'WalletStickerGridFooter' : 'WalletStickerTutorialTile')}
          </IslandDescription>
        )}
        {!isCollectiblesTab && Boolean(transactions?.length && transferMinNanos) && (
          <IslandDescription>
            {lang('WalletTransactionsHidden', { amount: formatTonTextFromNanos(lang, transferMinNanos!, true) })}
          </IslandDescription>
        )}
      </div>
    );
  }

  function renderStickerMenu() {
    const {
      anchor, isOnCard, isColored, canColor,
    } = stickerMenu;

    return (
      <Menu
        isOpen={Boolean(editor.menu)}
        anchor={anchor}
        autoClose
        getTriggerElement={getEditorLayer}
        getRootElement={getEditorLayer}
        getMenuElement={getStickerMenuElement}
        onClose={editor.closeMenu}
      >
        {(isColored || canColor) && (
          <MenuItem icon={isColored ? 'eraser' : 'palette'} onClick={handleApplyColor}>
            {lang(isColored ? 'WalletStickerRemoveColor' : 'WalletStickerApplyColor')}
          </MenuItem>
        )}
        <MenuItem icon={isOnCard ? 'close-circle' : 'card-star'} onClick={handleAddToCard}>
          {lang(isOnCard ? 'WalletStickerRemoveFromCard' : 'WalletStickerAddToCard')}
        </MenuItem>
      </Menu>
    );
  }

  function formatGramAmount(nanos: bigint) {
    return formatTonAsIcon(lang, formatTonNumber(lang, nanos, true));
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
        stickers={cardDecoration?.stickers}
        backgroundAddress={cardDecoration?.backgroundAddress}
        hiddenStickerAddresses={editor.hiddenAddresses}
        playingStickerAddress={editor.playingAddress}
        faceRef={faceRef}
        foldRef={foldRef}
        isTiltDisabled={editor.isActive}
        styleWave={styleWave}
        onQrClick={onReceive}
        onStickerPlayEnd={editor.handlePlayEnd}
      />
      <WalletCardEditorOverlay
        container={dialogElement}
        motionItems={editor.motionItems}
        framePose={editor.framePose}
        isCarrying={editor.isCarrying}
        isFlat={!canAnimate}
        frameRef={editor.frameRef}
        layerRef={editorLayerRef}
        onMotionViewChange={editor.registerMotionView}
        onHandlePointerDown={editor.handleHandlePointerDown}
      >
        {renderStickerMenu()}
      </WalletCardEditorOverlay>
      <div ref={buttonsRef} className={styles.buttons}>
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
      <div className={buildClassName(styles.section, hasHistory && styles.sectionFilled)}>
        {renderHistory()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
    const cardDecoration = selectOwnWalletCardDecoration(global);

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
      transactions: selectWalletTransactions(global),
      transferMinNanos: global.appConfig.walletTransferMinNanos,
      collectibles: global.wallet?.collectibles,
      cardDecoration,
      isCardEdited: Boolean(cardDecoration) && cardDecoration === global.wallet?.cardDraft,
      canEditCard: selectCanEditOwnWalletCard(global),
      cardBackgroundCollections: global.appConfig.walletCardBackgroundCollections,
      canAnimate: selectCanAnimateInterface(global),
      theme: selectTheme(global),
      existingWaltBalanceUrl: global.wallet?.existingWaltBalanceUrl,
      savedWallets: global.wallet?.savedWallets,
      earningsNanos: global.ton?.balance.amount,
    };
  },
)(WalletMainScreen));
