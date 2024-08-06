import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarTopupOption, ApiUser } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
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
};

const StarsBalanceModal = ({
  modal, starsBalanceState, originPaymentBot,
}: OwnProps & StateProps) => {
  const { closeStarsBalanceModal, loadStarsTransactions, openInvoice } = getActions();

  const { balance, history, topupOptions } = starsBalanceState || {};

  const lang = useOldLang();

  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [areOptionsExtended, markOptionsExtended, unmarkOptionsExtended] = useFlag();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const isOpen = Boolean(modal && starsBalanceState);

  const productStarsPrice = modal?.originPayment?.invoice?.amount;
  const starsNeeded = productStarsPrice ? productStarsPrice - (balance || 0) : undefined;
  const originBotName = originPaymentBot && getUserFullName(originPaymentBot);
  const shouldShowTransactions = Boolean(history?.all?.transactions.length && !modal?.originPayment);

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
      unmarkOptionsExtended();
      setSelectedTabIndex(0);
    }
  }, [isOpen]);

  const [renderingOptions, canExtend] = useMemo(() => {
    if (!topupOptions) {
      return [undefined, false];
    }

    const maxOption = topupOptions.reduce((max, option) => (
      max.stars > option.stars ? max : option
    ));
    const forceShowAll = starsNeeded && maxOption.stars < starsNeeded;

    const result: { option: ApiStarTopupOption; starsCount: number }[] = [];
    let currentStackedStarsCount = 0;
    let canExtendOptions = false;
    topupOptions.forEach((option) => {
      if (!option.isExtended) currentStackedStarsCount++;

      if (starsNeeded && !forceShowAll && option.stars < starsNeeded) return;
      if (!areOptionsExtended && option.isExtended) {
        canExtendOptions = true;
        return;
      }
      result.push({
        option,
        starsCount: currentStackedStarsCount,
      });
    });

    return [result, canExtendOptions];
  }, [areOptionsExtended, topupOptions, starsNeeded]);

  const tosText = useMemo(() => {
    if (!isOpen) return undefined;

    const text = lang('lng_credits_summary_options_about');
    const parts = text.split('{link}');
    return [
      parts[0],
      <SafeLink url={lang('StarsTOSLink')} text={lang('lng_credits_summary_options_about_link')} />,
      parts[1],
    ];
  }, [isOpen, lang]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  const handleClick = useLastCallback((option: ApiStarTopupOption) => {
    openInvoice({
      type: 'stars',
      option,
    });
  });

  const handleLoadMore = useLastCallback(() => {
    loadStarsTransactions({
      type: TRANSACTION_TYPES[selectedTabIndex],
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
            {lang('TelegramStars')}
          </h2>
        </div>
        <div className={styles.section}>
          <img className={styles.logo} src={StarLogo} alt="" draggable={false} />
          <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
          <h2 className={styles.headerText}>
            {starsNeeded ? lang('StarsNeededTitle', starsNeeded) : lang('TelegramStars')}
          </h2>
          <div className={styles.description}>
            {renderText(
              starsNeeded ? lang('StarsNeededText', originBotName) : lang('TelegramStarsInfo'),
              ['simple_markdown', 'emoji'],
            )}
          </div>
          <div className={styles.options}>
            {renderingOptions?.map(({ option, starsCount }) => (
              <StarTopupOption option={option} starsCount={starsCount} onClick={handleClick} />
            ))}
            {!areOptionsExtended && canExtend && (
              <Button className={styles.moreOptions} isText noForcedUpperCase onClick={markOptionsExtended}>
                {lang('Stars.Purchase.ShowMore')}
                <Icon className={styles.iconDown} name="down" />
              </Button>
            )}
          </div>
        </div>
        <div className={styles.secondaryInfo}>
          {tosText}
        </div>
        {shouldShowTransactions && (
          <>
            <TabList
              big
              activeTab={selectedTabIndex}
              tabs={TRANSACTION_TABS}
              onSwitchTab={setSelectedTabIndex}
            />
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
          </>
        )}
      </div>
    </Modal>
  );
};

function StarTopupOption({
  option, starsCount, onClick,
}: {
  option: ApiStarTopupOption; starsCount: number; onClick?: (option: ApiStarTopupOption) => void;
}) {
  const lang = useOldLang();

  return (
    <div className={styles.option} key={option.stars} onClick={() => onClick?.(option)}>
      <div className={styles.optionTop}>
        +{formatInteger(option.stars)}
        {/* Switch directionality for correct order. Can't use flex because https://issues.chromium.org/issues/40249030 */}
        <div className={styles.stackedStars} dir={lang.isRtl ? 'ltr' : 'rtl'}>
          {Array.from({ length: starsCount }).map(() => (
            <StarIcon className={styles.stackedStar} type="gold" size="big" />
          ))}
        </div>
      </div>
      <div className={styles.optionBottom}>
        {formatCurrency(option.amount, option.currency, lang.code)}
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const botId = modal?.originPayment?.botId;
    const bot = botId ? selectUser(global, botId) : undefined;

    return {
      starsBalanceState: global.stars,
      originPaymentBot: bot,
    };
  },
)(StarsBalanceModal));
