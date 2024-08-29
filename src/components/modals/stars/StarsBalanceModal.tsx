import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarTopupOption, ApiUser } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectIsPremiumPurchaseBlocked, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

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
import TransactionItem from './StarsTransactionItem';
import StarTopupOptionList from './StarTopupOptionList';

import styles from './StarsBalanceModal.module.scss';

import StarLogo from '../../../assets/icons/StarLogo.svg';
import StarsBackground from '../../../assets/stars-bg.png';

const TRANSACTION_TYPES = ['all', 'inbound', 'outbound'] as const;
const TRANSACTION_TABS: TabWithProperties[] = [
  { title: 'StarsTransactionsAll' },
  { title: 'StarsTransactionsIncoming' },
  { title: 'StarsTransactionsOutgoing' },
];

export type OwnProps = {
  modal: TabState['starsBalanceModal'];
};

type StateProps = {
  starsBalanceState?: GlobalState['stars'];
  originPaymentBot?: ApiUser;
  canBuyPremium?: boolean;
};

const StarsBalanceModal = ({
  modal, starsBalanceState, originPaymentBot, canBuyPremium,
}: OwnProps & StateProps) => {
  const {
    closeStarsBalanceModal, loadStarsTransactions, openInvoice, openStarsGiftingModal,
  } = getActions();

  const { balance, history, topupOptions } = starsBalanceState || {};

  const oldLang = useOldLang();
  const lang = useLang();

  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const isOpen = Boolean(modal && starsBalanceState);

  const productStarsPrice = modal?.originPayment?.invoice?.amount;
  const starsNeeded = productStarsPrice ? productStarsPrice - (balance || 0) : undefined;
  const originBotName = originPaymentBot && getUserFullName(originPaymentBot);
  const shouldShowTransactions = Boolean(history?.all?.transactions.length && !modal?.originPayment);

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      setSelectedTabIndex(0);
    }
  }, [isOpen]);

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

  const handleClick = useLastCallback((option: ApiStarTopupOption) => {
    openInvoice({
      type: 'stars',
      stars: option.stars,
      currency: option.currency,
      amount: option.amount,
    });
  });

  function renderStarOptionList() {
    return (
      <StarTopupOptionList
        isActive={isOpen}
        options={topupOptions}
        starsNeeded={starsNeeded}
        onClick={handleClick}
      />
    );
  }

  const handleLoadMore = useLastCallback(() => {
    loadStarsTransactions({
      type: TRANSACTION_TYPES[selectedTabIndex],
    });
  });

  const openPremiumGiftingModalHandler = useLastCallback(() => {
    openStarsGiftingModal({});
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
            {starsNeeded ? oldLang('StarsNeededTitle', starsNeeded) : oldLang('TelegramStars')}
          </h2>
          <div className={styles.description}>
            {renderText(
              starsNeeded ? oldLang('StarsNeededText', originBotName) : oldLang('TelegramStarsInfo'),
              ['simple_markdown', 'emoji'],
            )}
          </div>
          <div className={styles.options}>
            {renderStarOptionList()}
            {canBuyPremium && (
              <Button
                className={buildClassName(styles.starButton, 'settings-main-menu-star')}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={openPremiumGiftingModalHandler}
              >
                <StarIcon className="icon" type="gold" size="big" />
                {oldLang('TelegramStarsGift')}
              </Button>
            )}
          </div>
        </div>
        <div className={styles.secondaryInfo}>
          {tosText}
        </div>
        {shouldShowTransactions && (
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
                  onLoadMore={handleLoadMore}
                  items={history?.[TRANSACTION_TYPES[selectedTabIndex]]?.transactions}
                  className={styles.transactions}
                  noFastList
                >
                  {history?.[TRANSACTION_TYPES[selectedTabIndex]]?.transactions.map((transaction) => (
                    <TransactionItem
                      key={`${transaction.id}-${transaction.isRefund}`}
                      transaction={transaction}
                    />
                  ))}
                </InfiniteScroll>
              </Transition>
            </div>
            <TabList
              big
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
  (global, { modal }): StateProps => {
    const botId = modal?.originPayment?.botId;
    const bot = botId ? selectUser(global, botId) : undefined;

    return {
      starsBalanceState: global.stars,
      originPaymentBot: bot,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
    };
  },
)(StarsBalanceModal));
