import { memo, useEffect, useMemo, useRef, useState } from '@teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiStarTopupOption } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { AnimationLevel } from '../../../types';
import type { RegularLangKey } from '../../../types/language';

import {
  PAID_MESSAGES_PURPOSE,
  STARS_CURRENCY_CODE,
  TON_CURRENCY_CODE,
} from '../../../config';
import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChat, selectIsPremiumPurchaseBlocked, selectUser } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState.ts';
import buildClassName from '../../../util/buildClassName';
import { convertCurrencyFromBaseUnit, convertTonToUsd, formatCurrencyAsString } from '../../../util/formatCurrency';
import { resolveTransitionName } from '../../../util/resolveTransitionName.ts';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Modal from '../../ui/Modal';
import TabList, { type TabWithProperties } from '../../ui/TabList';
import Transition from '../../ui/Transition';
import ParticlesHeader from '../common/ParticlesHeader.tsx';
import BalanceBlock from './BalanceBlock';
import StarTopupOptionList from './StarTopupOptionList';
import StarsSubscriptionItem from './subscription/StarsSubscriptionItem';
import StarsTransactionItem from './transaction/StarsTransactionItem';

import styles from './StarsBalanceModal.module.scss';

const HEADER_HEIGHT = 3.5 * REM;
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
  shouldForceHeight?: boolean;
  tonUsdRate?: number;
  tonTopupUrl: string;
  animationLevel: AnimationLevel;
};

const StarsBalanceModal = ({
  modal, starsBalanceState, tonBalanceState, canBuyPremium, shouldForceHeight, tonUsdRate, tonTopupUrl, animationLevel,
}: OwnProps & StateProps) => {
  const {
    closeStarsBalanceModal, loadStarsTransactions, loadStarsSubscriptions, openStarsGiftingPickerModal, openInvoice,
    openUrl,
  } = getActions();

  const currency = modal?.currency || STARS_CURRENCY_CODE;
  const currentState = currency === TON_CURRENCY_CODE ? tonBalanceState : starsBalanceState;
  const { balance, history } = currentState || {};
  const { subscriptions } = (currency === STARS_CURRENCY_CODE && starsBalanceState) || {};

  const oldLang = useOldLang();
  const lang = useLang();

  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [areTabsPinned, pinTabs, unpinTabs] = useFlag(false);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [areBuyOptionsShown, showBuyOptions, hideBuyOptions] = useFlag();

  const tabsRef = useRef<HTMLDivElement>();

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
  const starsNeeded = ongoingTransactionAmount ? ongoingTransactionAmount - (balance?.amount || 0) : undefined;
  const starsNeededText = useMemo(() => {
    const global = getGlobal();

    if (originReaction) {
      const channel = selectChat(global, originReaction.chatId);
      if (!channel) return undefined;
      return oldLang('StarsNeededTextReactions', getChatTitle(oldLang, channel));
    }

    if (originStarsPayment) {
      const bot = originStarsPayment.form?.botId ? selectUser(global, originStarsPayment.form.botId) : undefined;
      if (!bot) return undefined;
      return oldLang('StarsNeededText', getUserFullName(bot));
    }

    if (originGift) {
      const peer = selectUser(global, originGift.peerId);
      if (!peer) return undefined;
      return oldLang('StarsNeededTextGift', getPeerTitle(lang, peer));
    }

    if (topup?.purpose === SUBSCRIPTION_PURPOSE) {
      return oldLang('StarsNeededTextLink');
    }

    if (topup?.purpose === PAID_MESSAGES_PURPOSE) {
      return lang('StarsNeededTextSendPaidMessages', undefined, {
        withMarkdown: true,
        withNodes: true,
      });
    }

    return undefined;
  }, [originReaction, originStarsPayment, originGift, topup?.purpose, lang, oldLang]);

  const shouldShowItems = Boolean(history?.all?.transactions.length && !shouldOpenOnBuy);
  const shouldSuggestGifting = !shouldOpenOnBuy;

  const modalHeight = useMemo(() => {
    const transactionCount = history?.all?.transactions.length || 0;
    if (transactionCount === 1) {
      return '35.5rem';
    }
    if (transactionCount === 2) {
      return '39.25rem';
    }
    if (transactionCount === 3) {
      return '43rem';
    }
    return '45rem';
  }, [history?.all?.transactions.length]);

  const transactionTabs: TabWithProperties[] = useMemo(() => {
    return TRANSACTION_TABS_KEYS.map((key) => ({
      title: lang(key),
    }));
  }, [lang]);

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      setSelectedTabIndex(0);
      hideBuyOptions();
      unpinTabs();
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

    const text = oldLang('lng_credits_summary_options_about');
    const parts = text.split('{link}');
    return [
      parts[0],
      <SafeLink url={oldLang('StarsTOSLink')} text={oldLang('lng_credits_summary_options_about_link')} />,
      parts[1],
    ];
  }, [isOpen, oldLang]);

  const renderStarsHeaderSection = () => {
    return (
      <>
        <ParticlesHeader
          model="swaying-star"
          color="gold"
          title={starsNeeded ? oldLang('StarsNeededTitle', ongoingTransactionAmount) : oldLang('TelegramStars')}
          description={renderText(
            starsNeededText || oldLang('TelegramStarsInfo'),
            ['simple_markdown', 'emoji'],
          )}
          isDisabled={!isOpen}
        />
        {canBuyPremium && !areBuyOptionsShown && (
          <Button
            className={styles.starButton}
            onClick={showBuyOptions}
            fluid
          >
            {oldLang('Star.List.BuyMoreStars')}
          </Button>
        )}
        {canBuyPremium && !areBuyOptionsShown && shouldSuggestGifting && (
          <Button
            isText
            noForcedUpperCase
            className={styles.starButton}
            fluid
            onClick={openStarsGiftingPickerModalHandler}
          >
            {oldLang('TelegramStarsGift')}
          </Button>
        )}
        {areBuyOptionsShown && starsBalanceState?.topupOptions && (
          <StarTopupOptionList
            starsNeeded={starsNeeded}
            options={starsBalanceState.topupOptions}
            onClick={handleBuyStars}
          />
        )}
      </>
    );
  };

  const renderTonHeaderSection = () => {
    const tonAmount = convertCurrencyFromBaseUnit(balance?.amount || 0, TON_CURRENCY_CODE);
    return (
      <>
        <ParticlesHeader
          model="speeding-diamond"
          color="blue"
          title={lang('CurrencyTon')}
          description={lang('DescriptionAboutTon')}
          isDisabled={!isOpen}
        />
        <div className={styles.tonBalanceContainer}>
          <div className={styles.tonBalance}>
            <Icon name="toncoin" className={styles.tonIconBalance} />
            {tonAmount}
          </div>
          {Boolean(tonUsdRate) && (
            <span className={styles.tonInUsd}>
              {`≈ ${formatCurrencyAsString(
                convertTonToUsd(balance?.amount || 0, tonUsdRate, true),
                'USD',
                lang.code,
              )}`}
            </span>
          )}
        </div>
        <Button
          className={styles.topUpButton}
          onClick={handleTonTopUp}
          fluid
        >
          {lang('ButtonTopUpViaFragment')}
        </Button>

        {currency === TON_CURRENCY_CODE && (
          <div className={styles.hint}>
            {lang('TonModalHint')}
          </div>
        )}
      </>
    );
  };

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);

    if (tabsRef.current) {
      const { top: tabsTop } = tabsRef.current.getBoundingClientRect();
      const { top: scrollerTop } = e.currentTarget.getBoundingClientRect();
      const isPinned = tabsTop - scrollerTop <= HEADER_HEIGHT;
      if (isPinned) {
        pinTabs();
      } else {
        unpinTabs();
      }
    }
  }

  const handleLoadMoreTransactions = useLastCallback(() => {
    loadStarsTransactions({
      type: TRANSACTION_TYPES[selectedTabIndex],
      isTon: currency === TON_CURRENCY_CODE,
    });
  });

  const handleLoadMoreSubscriptions = useLastCallback(() => {
    loadStarsSubscriptions();
  });

  const openStarsGiftingPickerModalHandler = useLastCallback(() => {
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

  const handleTonTopUp = useLastCallback(() => {
    openUrl({ url: tonTopupUrl });
  });

  return (
    <Modal
      className={buildClassName(styles.root, !shouldForceHeight && !areBuyOptionsShown && styles.minimal)}
      isOpen={isOpen}
      onClose={closeStarsBalanceModal}
      dialogStyle={`--modal-height: ${modalHeight}`}
      hasAbsoluteCloseButton
    >
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        {currency !== TON_CURRENCY_CODE && <BalanceBlock balance={balance} className={styles.modalBalance} />}
        <div
          className={buildClassName(
            styles.header, isHeaderHidden && styles.hiddenHeader, areTabsPinned && styles.noSeparator,
          )}
        >
          <h2 className={styles.starHeaderText}>
            {oldLang('TelegramStars')}
          </h2>
        </div>
        <div className={styles.section}>
          {currency === TON_CURRENCY_CODE ? renderTonHeaderSection() : renderStarsHeaderSection()}
        </div>
        {areBuyOptionsShown && (
          <div className={styles.tos}>
            {tosText}
          </div>
        )}
        {shouldShowItems && Boolean(subscriptions?.list.length) && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{oldLang('StarMySubscriptions')}</h3>
            <div className={styles.subscriptions}>
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
                  {oldLang('StarMySubscriptionsExpand')}
                </Button>
              )}
            </div>
          </div>
        )}
        {shouldShowItems && (
          <div className={styles.container}>
            <div className={styles.lastSection}>
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
                  noScrollRestoreOnTop
                >
                  {history?.[TRANSACTION_TYPES[selectedTabIndex]]?.transactions.map((transaction) => (
                    <StarsTransactionItem
                      key={`${transaction.id}-${transaction.isRefund}`}
                      transaction={transaction}
                      className={TRANSACTION_ITEM_CLASS}
                    />
                  ))}
                </InfiniteScroll>
              </Transition>
            </div>
            <TabList
              ref={tabsRef}
              className={styles.tabs}
              tabClassName={styles.tab}
              activeTab={selectedTabIndex}
              tabs={transactionTabs}
              onSwitchTab={setSelectedTabIndex}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const shouldForceHeight = modal?.currency === TON_CURRENCY_CODE
      ? Boolean(global.ton?.history?.all?.transactions.length)
      : Boolean(global.stars?.history?.all?.transactions.length);

    return {
      shouldForceHeight,
      starsBalanceState: global.stars,
      tonBalanceState: global.ton,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      tonUsdRate: global.appConfig.tonUsdRate,
      tonTopupUrl: global.appConfig.tonTopupUrl,
      animationLevel: selectSharedSettings(global).animationLevel,
    };
  },
)(StarsBalanceModal));
