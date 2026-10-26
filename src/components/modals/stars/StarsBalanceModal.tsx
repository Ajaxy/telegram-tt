import { memo, useEffect, useMemo, useRef, useState } from '@teact';
import { setExtraStyles, toggleExtraClass } from '@teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiStarTopupOption } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { AnimationLevel } from '../../../types';
import type { RegularLangKey } from '../../../types/language';

import { PAID_MESSAGES_PURPOSE, STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChat, selectIsPremiumPurchaseBlocked, selectUser } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState.ts';
import buildClassName from '../../../util/buildClassName';
import { convertTonFromNanos, convertTonToUsd, formatCurrencyAsString } from '../../../util/formatCurrency';
import { clamp } from '../../../util/math';
import { resolveTransitionName } from '../../../util/resolveTransitionName.ts';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GramIcon from '../../common/icons/GramIcon';
import Icon from '../../common/icons/Icon';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import TabList, { type TabWithProperties } from '../../ui/TabList';
import Transition from '../../ui/Transition';
import ParticlesHeader from '../common/ParticlesHeader.tsx';
import BalanceBlock from './BalanceBlock';
import StarTopupOptionList from './StarTopupOptionList';
import StarsSubscriptionItem from './subscription/StarsSubscriptionItem';
import StarsTransactionItem from './transaction/StarsTransactionItem';
import Island, { IslandDescription, IslandTitle } from '@gili/layout/Island';
import Modal, {
  ModalCloseButton, ModalHeader, ModalHeaderAction, ModalTitle,
} from '@gili/modal/Modal';

import styles from './StarsBalanceModal.module.scss';

const HEADER_STRIP_FADE_DISTANCE = 1.5 * REM;
const TRANSACTION_TYPES = ['all', 'inbound', 'outbound'] as const;
const TRANSACTION_TABS_KEYS: RegularLangKey[] = [
  'StarsTransactionsAll',
  'StarsTransactionsIncoming',
  'StarsTransactionsOutgoing',
];
const TRANSACTION_ITEM_CLASS = 'StarsTransactionItem';
const SUBSCRIPTION_PURPOSE = 'subs';

export type OwnProps = {
  modal: TabState['starsBalanceModal'];
};

type StateProps = {
  starsBalanceState?: GlobalState['stars'];
  tonBalanceState?: GlobalState['ton'];
  canBuyPremium?: boolean;
  tonUsdRate?: number;
  animationLevel: AnimationLevel;
};

const StarsBalanceModal = ({
  modal, starsBalanceState, tonBalanceState, canBuyPremium, tonUsdRate, animationLevel,
}: OwnProps & StateProps) => {
  const {
    closeStarsBalanceModal, loadStarsTransactions, loadStarsSubscriptions, openStarsGiftingPickerModal, openInvoice,
    openWalletModal,
  } = getActions();

  const isTon = modal?.currency === TON_CURRENCY_CODE;
  const currentState = isTon ? tonBalanceState : starsBalanceState;
  const { balance, history } = currentState || {};
  const { subscriptions } = (!isTon && starsBalanceState) || {};

  const lang = useLang();

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [areBuyOptionsShown, showBuyOptions, hideBuyOptions] = useFlag();

  const headerRef = useRef<HTMLDivElement>();
  const historyRef = useRef<HTMLDivElement>();

  const isOpen = Boolean(modal && (starsBalanceState || tonBalanceState));

  const {
    originStarsPayment, originReaction, originGift, topup,
  } = modal || {};

  const shouldOpenOnBuy = originStarsPayment || originReaction || originGift || topup;

  const ongoingTransactionAmount = originStarsPayment?.form?.invoice?.totalAmount
    || originStarsPayment?.subscriptionInfo?.subscriptionPricing?.amount
    || originReaction?.amount
    || originGift?.gift.stars
    || topup?.balanceNeeded;
  const starsBalanceAmount = balance?.currency === STARS_CURRENCY_CODE ? balance.amount : 0;
  const starsNeeded = ongoingTransactionAmount ? ongoingTransactionAmount - starsBalanceAmount : undefined;
  const starsTitle = starsNeeded
    ? lang('StarsNeededTitle', { count: ongoingTransactionAmount }, { pluralValue: ongoingTransactionAmount! })
    : lang('TelegramStars');
  const title = isTon ? lang('GramEarnings') : starsTitle;
  const starsNeededText = useMemo(() => {
    const global = getGlobal();

    if (originReaction) {
      const channel = selectChat(global, originReaction.chatId);
      if (!channel) return undefined;
      return lang('StarsNeededTextReactions', { chat: getChatTitle(lang, channel) });
    }

    if (originStarsPayment) {
      const bot = originStarsPayment.form?.botId ? selectUser(global, originStarsPayment.form.botId) : undefined;
      if (!bot) return undefined;
      return lang('StarsNeededText', { user: getUserFullName(lang, bot) });
    }

    if (originGift) {
      const peer = selectUser(global, originGift.peerId);
      if (!peer) return undefined;
      return lang('StarsNeededTextGift', { peer: getPeerTitle(lang, peer) });
    }

    if (topup?.purpose === SUBSCRIPTION_PURPOSE) {
      return lang('StarsNeededTextLink');
    }

    if (topup?.purpose === PAID_MESSAGES_PURPOSE) {
      return lang('StarsNeededTextSendPaidMessages', undefined, {
        withMarkdown: true,
        withNodes: true,
      });
    }

    return undefined;
  }, [originReaction, originStarsPayment, originGift, topup?.purpose, lang]);

  const hasHistory = Boolean(history?.all?.transactions.length);
  const shouldShowItems = hasHistory && !shouldOpenOnBuy;
  const shouldSuggestGifting = !shouldOpenOnBuy;

  const transactionTabs: TabWithProperties[] = useMemo(() => {
    return TRANSACTION_TABS_KEYS.map((key) => ({
      title: lang(key),
    }));
  }, [lang]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTabIndex(0);
      hideBuyOptions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (shouldOpenOnBuy) {
      showBuyOptions();
      return;
    }

    hideBuyOptions();
  }, [shouldOpenOnBuy]);

  const tosText = useMemo(() => {
    if (!isOpen) return undefined;

    return lang('CreditsSummaryOptionsAbout', {
      link: <SafeLink url={lang('StarsTOSLink')} text={lang('CreditsSummaryOptionsAboutLink')} />,
    }, { withNodes: true });
  }, [isOpen, lang]);

  const renderStarsHeaderSection = () => {
    return (
      <>
        <ParticlesHeader
          model="swaying-star"
          color="gold"
          title={title}
          description={renderText(
            starsNeededText || lang('TelegramStarsInfo'),
            ['simple_markdown', 'emoji'],
          )}
          isDisabled={!isOpen}
          className={styles.particlesHeader}
          titleClassName={styles.heroTitle}
        />
        {canBuyPremium && !areBuyOptionsShown && (
          <Button pill onClick={showBuyOptions}>
            {lang('StarListBuyMoreStars')}
          </Button>
        )}
        {canBuyPremium && !areBuyOptionsShown && shouldSuggestGifting && (
          <Button
            isText
            pill
            className={styles.giftButton}
            onClick={openStarsGiftingPickerModalHandler}
          >
            {lang('TelegramStarsGift')}
          </Button>
        )}
        {areBuyOptionsShown && starsBalanceState?.topupOptions && (
          <Island>
            <StarTopupOptionList
              starsNeeded={starsNeeded}
              options={starsBalanceState.topupOptions}
              onClick={handleBuyStars}
            />
          </Island>
        )}
        {areBuyOptionsShown && <IslandDescription>{tosText}</IslandDescription>}
      </>
    );
  };

  const renderTonHeaderSection = () => {
    const tonNanos = balance?.currency === TON_CURRENCY_CODE ? balance.amount : 0n;
    return (
      <>
        <ParticlesHeader
          model="diamond-3d"
          color="blue"
          title={title}
          description={lang('GramEarningsText')}
          isDisabled={!isOpen}
          className={styles.particlesHeader}
          titleClassName={styles.heroTitle}
        />
        <div className={styles.tonBalance}>
          <GramIcon className={styles.tonIconBalance} />
          {convertTonFromNanos(tonNanos)}
        </div>
        {Boolean(tonUsdRate) && (
          <div className={styles.tonInUsd}>
            {`≈ ${formatCurrencyAsString(
              convertTonToUsd(tonNanos, tonUsdRate),
              'USD',
              lang.code,
            )}`}
          </div>
        )}
      </>
    );
  };

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scroller = e.currentTarget;
    const { scrollTop } = scroller;
    const heroTitleElement = scroller.querySelector<HTMLElement>(`.${styles.heroTitle}`)!;
    const headerElement = headerRef.current!;
    const distance = getCenterY(heroTitleElement) - getCenterY(headerElement);
    const progress = clamp(scrollTop / (scrollTop + distance), 0, 1);
    const stripOpacity = clamp(-distance / HEADER_STRIP_FADE_DISTANCE, 0, 1);
    const isCollapsed = distance <= 0;

    requestMutation(() => {
      setExtraStyles(heroTitleElement, { '--hero-title-progress': String(progress) });
      setExtraStyles(headerElement, { '--header-strip-opacity': String(stripOpacity) });
      toggleExtraClass(heroTitleElement, styles.heroTitleHidden, isCollapsed);
      toggleExtraClass(headerElement, styles.headerCollapsed, isCollapsed);
    });
  });

  // The wallet's native dialog would cover this modal, so the wallet is closed while it is open. When the wallet
  // opened it, leaving reopens the wallet.
  const handleClose = useLastCallback(() => {
    closeStarsBalanceModal();

    if (modal?.shouldReturnToWallet) openWalletModal();
  });

  const handleSwitchTab = useLastCallback((index: number) => {
    setSelectedTabIndex(index);

    const historyElement = historyRef.current!;
    const offset = historyElement.getBoundingClientRect().top - headerRef.current!.getBoundingClientRect().bottom;
    if (offset >= 0) return;

    requestMutation(() => {
      historyElement.closest(`.${styles.main}`)!.scrollBy({ top: offset, behavior: 'smooth' });
    });
  });

  const handleLoadMoreTransactions = useLastCallback(() => {
    loadStarsTransactions({
      type: TRANSACTION_TYPES[selectedTabIndex],
      isTon,
    });
  });

  const handleLoadMoreSubscriptions = useLastCallback(() => {
    loadStarsSubscriptions();
  });

  const openStarsGiftingPickerModalHandler = useLastCallback(() => {
    closeStarsBalanceModal();
    openStarsGiftingPickerModal({});
  });

  const handleBuyStars = useLastCallback((option: ApiStarTopupOption) => {
    const originPaymentInputInvoice = originStarsPayment?.inputInvoice;

    let spendPurposePeerId: string | undefined;

    switch (originPaymentInputInvoice?.type) {
      case 'message': {
        spendPurposePeerId = originPaymentInputInvoice.chatId;
        break;
      }

      case 'slug': {
        const form = originStarsPayment?.form;
        spendPurposePeerId = form?.botId;
        break;
      }
    }

    if (originReaction) {
      spendPurposePeerId = originReaction.chatId;
    }

    openInvoice({
      type: 'stars',
      stars: option.stars,
      currency: option.currency,
      amount: option.amount,
      spendPurposePeerId,
    });
  });

  const header = (
    <ModalHeader ref={headerRef} className={styles.header} noMask>
      <ModalCloseButton onBack={modal?.shouldReturnToWallet ? handleClose : undefined} />
      <ModalTitle>
        <span className={styles.headerTitle}>{title}</span>
      </ModalTitle>
      {!isTon && (
        <ModalHeaderAction>
          <BalanceBlock balance={balance} className={styles.headerBalance} />
        </ModalHeaderAction>
      )}
    </ModalHeader>
  );

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      dialogClassName={styles.dialog}
      noContentInlinePadding
      noScrollable
      onClose={handleClose}
    >
      <div
        className={buildClassName(
          styles.main, 'custom-scroll', (hasHistory || areBuyOptionsShown) && styles.fixedHeight,
        )}
        onScroll={handleScroll}
      >
        <div className={styles.content}>
          <div className={styles.intro}>
            {isTon ? renderTonHeaderSection() : renderStarsHeaderSection()}
          </div>
          {shouldShowItems && Boolean(subscriptions?.list.length) && (
            <div>
              <IslandTitle>{lang('StarMySubscriptions')}</IslandTitle>
              <Island>
                {subscriptions?.list.map((subscription) => (
                  <StarsSubscriptionItem
                    key={subscription.id}
                    subscription={subscription}
                  />
                ))}
                {subscriptions?.nextOffset && (
                  <Button
                    isText
                    disabled={subscriptions.isLoading}
                    size="smaller"
                    noForcedUpperCase
                    className={styles.loadMore}
                    onClick={handleLoadMoreSubscriptions}
                  >
                    <Icon name="down" className={styles.loadMoreIcon} />
                    {lang('ShowMore')}
                  </Button>
                )}
              </Island>
            </div>
          )}
          {shouldShowItems && (
            <div ref={historyRef} className={styles.history}>
              <TabList
                className={styles.tabList}
                fadeMaskClassName={styles.tabs}
                activeTab={selectedTabIndex}
                tabs={transactionTabs}
                stretched
                withFadeMask
                onSwitchTab={handleSwitchTab}
              />
              <Island className={styles.historyIsland}>
                <Transition
                  name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
                  activeKey={selectedTabIndex}
                  renderCount={TRANSACTION_TABS_KEYS.length}
                  shouldRestoreHeight
                  className={styles.transition}
                >
                  <InfiniteScroll
                    onLoadMore={handleLoadMoreTransactions}
                    items={history?.[TRANSACTION_TYPES[selectedTabIndex]]?.transactions}
                    scrollContainerClosest={`.${styles.main}`}
                    itemSelector={`.${TRANSACTION_ITEM_CLASS}`}
                    className={styles.transactions}
                    noFastList
                    noScrollRestore
                  >
                    {history?.[TRANSACTION_TYPES[selectedTabIndex]]?.transactions.map((transaction) => (
                      <StarsTransactionItem
                        key={`${transaction.id}-${transaction.isRefund}`}
                        transaction={transaction}
                        className={buildClassName(TRANSACTION_ITEM_CLASS, styles.transactionItem)}
                      />
                    ))}
                  </InfiniteScroll>
                </Transition>
              </Island>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

function getCenterY(element: HTMLElement) {
  const { top, height } = element.getBoundingClientRect();

  return top + height / 2;
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      starsBalanceState: global.stars,
      tonBalanceState: global.ton,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      tonUsdRate: global.appConfig.tonUsdRate,
      animationLevel: selectSharedSettings(global).animationLevel,
    };
  },
)(StarsBalanceModal));
