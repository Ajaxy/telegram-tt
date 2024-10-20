import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiStarTopupOption } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { selectChat, selectIsPremiumPurchaseBlocked, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Modal from '../../ui/Modal';
import TabList, { type TabWithProperties } from '../../ui/TabList';
import Transition from '../../ui/Transition';
import BalanceBlock from './BalanceBlock';
import StarTopupOptionList from './StarTopupOptionList';
import StarsSubscriptionItem from './subscription/StarsSubscriptionItem';
import StarsTransactionItem from './transaction/StarsTransactionItem';

import styles from './StarsBalanceModal.module.scss';

import StarLogo from '../../../assets/icons/StarLogo.svg';
import StarsBackground from '../../../assets/stars-bg.png';

const TRANSACTION_TYPES = ['all', 'inbound', 'outbound'] as const;
const TRANSACTION_TABS: TabWithProperties[] = [
  { title: 'StarsTransactionsAll' },
  { title: 'StarsTransactionsIncoming' },
  { title: 'StarsTransactionsOutgoing' },
];
const TRANSACTION_ITEM_CLASS = 'StarsTransactionItem';

export type OwnProps = {
  modal: TabState['starsBalanceModal'];
};

type StateProps = {
  starsBalanceState?: GlobalState['stars'];
  canBuyPremium?: boolean;
};

const StarsBalanceModal = ({
  modal, starsBalanceState, canBuyPremium,
}: OwnProps & StateProps) => {
  const {
    closeStarsBalanceModal, loadStarsTransactions, openStarsGiftingModal, openInvoice,
  } = getActions();

  const { balance, history, subscriptions } = starsBalanceState || {};

  const oldLang = useOldLang();
  const lang = useLang();

  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [areBuyOptionsShown, showBuyOptions, hideBuyOptions] = useFlag();

  const isOpen = Boolean(modal && starsBalanceState);

  const { originPayment, originReaction } = modal || {};

  const ongoingTransactionAmount = originPayment?.invoice?.amount || originReaction?.amount;
  const starsNeeded = ongoingTransactionAmount ? ongoingTransactionAmount - (balance || 0) : undefined;
  const starsNeededText = useMemo(() => {
    if (!starsNeeded || starsNeeded < 0) return undefined;
    const global = getGlobal();

    if (originReaction) {
      const channel = selectChat(global, originReaction.chatId);
      if (!channel) return undefined;
      return oldLang('StarsNeededTextReactions', getChatTitle(oldLang, channel));
    }

    if (originPayment) {
      const bot = selectUser(global, originPayment.botId!);
      if (!bot) return undefined;
      return oldLang('StarsNeededText', getUserFullName(bot));
    }

    return undefined;
  }, [oldLang, originPayment, originReaction, starsNeeded]);

  const shouldShowItems = Boolean(history?.all?.transactions.length && !originPayment && !originReaction);
  const shouldSuggestGifting = !originPayment && !originReaction;

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      setSelectedTabIndex(0);
      hideBuyOptions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (ongoingTransactionAmount) {
      showBuyOptions();
      return;
    }

    hideBuyOptions();
  }, [ongoingTransactionAmount]);

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

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  const handleLoadMoreTransactions = useLastCallback(() => {
    loadStarsTransactions({
      type: TRANSACTION_TYPES[selectedTabIndex],
    });
  });

  const openStarsGiftingModalHandler = useLastCallback(() => {
    openStarsGiftingModal({});
  });

  const handleBuyStars = useLastCallback((option: ApiStarTopupOption) => {
    openInvoice({
      type: 'stars',
      stars: option.stars,
      currency: option.currency,
      amount: option.amount,
    });
  });

  return (
    <Modal className={styles.root} isOpen={isOpen} onClose={closeStarsBalanceModal}>
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <Button
          round
          size="smaller"
          className={styles.closeButton}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => closeStarsBalanceModal()}
          ariaLabel={lang('Close')}
        >
          <Icon name="close" />
        </Button>
        <BalanceBlock balance={balance || 0} className={styles.modalBalance} />
        <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
          <h2 className={styles.starHeaderText}>
            {oldLang('TelegramStars')}
          </h2>
        </div>
        <div className={styles.section}>
          <img className={styles.logo} src={StarLogo} alt="" draggable={false} />
          <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
          <h2 className={styles.headerText}>
            {starsNeeded ? oldLang('StarsNeededTitle', ongoingTransactionAmount) : oldLang('TelegramStars')}
          </h2>
          <div className={styles.description}>
            {renderText(
              starsNeededText || oldLang('TelegramStarsInfo'),
              ['simple_markdown', 'emoji'],
            )}
          </div>
          {canBuyPremium && !areBuyOptionsShown && (
            <Button
              className={styles.starButton}
              onClick={showBuyOptions}
            >
              {oldLang('Star.List.BuyMoreStars')}
            </Button>
          )}
          {canBuyPremium && !areBuyOptionsShown && shouldSuggestGifting && (
            <Button
              className={buildClassName(styles.starButton, 'settings-main-menu-star')}
              color="translucent"
              onClick={openStarsGiftingModalHandler}
            >
              <StarIcon className="icon" type="gold" size="big" />
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
        </div>
        <div className={styles.secondaryInfo}>
          {tosText}
        </div>
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
            </div>
          </div>
        )}
        {shouldShowItems && (
          <div className={styles.container}>
            <div className={styles.section}>
              <Transition
                name={lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
                activeKey={selectedTabIndex}
                renderCount={TRANSACTION_TABS.length}
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
              className={styles.tabs}
              tabClassName={styles.tab}
              activeTab={selectedTabIndex}
              tabs={TRANSACTION_TABS}
              onSwitchTab={setSelectedTabIndex}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      starsBalanceState: global.stars,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
    };
  },
)(StarsBalanceModal));
