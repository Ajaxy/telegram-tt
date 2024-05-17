import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBoost, ApiBoostStatistics, ApiPrepaidGiveaway } from '../../../api/types';
import type { TabState } from '../../../global/types';

import {
  GIVEAWAY_BOOST_PER_PREMIUM,
} from '../../../config';
import { isChatChannel } from '../../../global/helpers';
import {
  selectChat,
  selectIsGiveawayGiftsPurchaseAvailable,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateAtTime } from '../../../util/date/dateFormat';
import { CUSTOM_PEER_TO_BE_DISTRIBUTED } from '../../../util/objects/customPeer';
import { formatInteger } from '../../../util/textFormat';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/Icon';
import LinkField from '../../common/LinkField';
import PremiumProgress from '../../common/PremiumProgress';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Spinner from '../../ui/Spinner';
import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import StatisticsOverview from './StatisticsOverview';

import styles from './BoostStatistics.module.scss';

import GiftBlueRound from '../../../assets/premium/GiftBlueRound.svg';
import GiftGreenRound from '../../../assets/premium/GiftGreenRound.svg';
import GiftRedRound from '../../../assets/premium/GiftRedRound.svg';

type StateProps = {
  boostStatistics: TabState['boostStatistics'];
  isGiveawayAvailable?: boolean;
  chatId: string;
  giveawayBoostsPerPremium?: number;
  isChannel?: boolean;
};

const GIVEAWAY_IMG_LIST: { [key: number]: string } = {
  3: GiftGreenRound,
  6: GiftBlueRound,
  12: GiftRedRound,
};

const BoostStatistics = ({
  boostStatistics,
  isGiveawayAvailable,
  chatId,
  giveawayBoostsPerPremium,
  isChannel,
}: StateProps) => {
  const {
    openChat, loadMoreBoosters, closeBoostStatistics, openGiveawayModal, showNotification,
  } = getActions();
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const isLoaded = boostStatistics?.boostStatus;
  const status = isLoaded ? boostStatistics.boostStatus : undefined;

  const isGiftListEqual = boostStatistics && boostStatistics?.boosts?.count
    === boostStatistics?.giftedBoosts?.count;
  const shouldDisplayGiftList = !isGiftListEqual && boostStatistics?.giftedBoosts
    && boostStatistics?.giftedBoosts?.list?.length > 0;

  const {
    currentLevel,
    hasNextLevel,
    boosts,
    levelProgress,
    remainingBoosts,
  } = useMemo(() => {
    if (!status) {
      return {
        currentLevel: 0,
        hasNextLevel: false,
        boosts: 0,
        levelProgress: 0,
        remainingBoosts: 0,
        prepaidGiveaways: [],
      };
    }
    return getBoostProgressInfo(status);
  }, [status]);

  const statsOverview = useMemo(() => {
    if (!status) return undefined;

    return {
      level: currentLevel,
      boosts,
      premiumSubscribers: status.premiumSubscribers!,
      remainingBoosts,
      prepaidGiveaways: status.prepaidGiveaways!,
    } satisfies ApiBoostStatistics;
  }, [status, boosts, currentLevel, remainingBoosts]);

  const tabs = useMemo(() => {
    if (shouldDisplayGiftList) {
      return [
        {
          type: 'boostList',
          title: lang('BoostingBoostsCount', boostStatistics?.boosts?.count, 'i'),
        },
        {
          type: 'giftedBoostList',
          title: lang('BoostingGiftsCount', boostStatistics?.giftedBoosts?.count, 'i'),
        },
      ];
    }
    return [];
  }, [shouldDisplayGiftList, lang, boostStatistics?.boosts?.count, boostStatistics?.giftedBoosts?.count]);

  const initialTab = useMemo(() => {
    return boostStatistics?.boosts && boostStatistics.boosts?.list.length > 0 ? 1 : 0;
  }, [boostStatistics]);

  const [activeTab, setActiveTab] = useState(initialTab);

  const renderingActiveTab = activeTab > tabs.length - 1 ? tabs.length - 1 : activeTab;

  const tabType = tabs[renderingActiveTab]?.type;

  const activeKey = tabs.findIndex(({ type }) => type === tabType);

  const boostersToLoadCount = useMemo(() => {
    if (!boostStatistics) return undefined;

    const list = shouldDisplayGiftList ? (tabType === 'boostList'
      ? boostStatistics.boosts : boostStatistics.giftedBoosts) : boostStatistics.boosts;
    if (!list?.count) return undefined;

    const loadedBoostsCount = list.list.reduce((total, boost) => {
      return total + (boost.multiplier || 1);
    }, 0);

    const totalCount = list.count;
    const toLoadCount = totalCount - loadedBoostsCount;

    return toLoadCount > 0 ? toLoadCount : undefined;
  }, [shouldDisplayGiftList, boostStatistics, tabType]);

  const renderBoostIcon = useLastCallback((multiplier: number) => (
    <div className={styles.quantity}>
      <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeButtonColor)}>
        <Icon name="boost" className={styles.floatingBadgeIcon} />
        <div className={styles.floatingBadgeValue}>{multiplier}</div>
      </div>
    </div>
  ));

  const renderBoostTypeIcon = useLastCallback((boost: ApiBoost) => {
    if (!boost.isFromGiveaway && !boost.isGift) {
      return undefined;
    }

    return (
      <div className={styles.quantity}>
        <div className={buildClassName(styles.floatingBadge,
          !boost.isFromGiveaway && styles.floatingBadgeWarning,
          styles.floatingBadgeButtonColor,
          styles.floatingBadgeButton)}
        >
          <Icon name="gift" className={styles.floatingBadgeIcon} />
          <div className={styles.floatingBadgeValue}>{lang(boost.isFromGiveaway
            ? 'lng_prizes_results_link' : 'BoostingGift')}
          </div>
        </div>
      </div>
    );
  });

  const handleBoosterClick = useLastCallback((userId?: string) => {
    if (!userId) {
      showNotification({
        message: lang('BoostingRecipientWillBeSelected'),
      });
      return;
    }
    openChat({ id: userId });
    closeBoostStatistics();
  });

  const renderBoostList = useLastCallback((boost) => {
    return (
      <ListItem
        className="chat-item-clickable"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleBoosterClick(boost.userId)}
      >
        <PrivateChatInfo
          className={styles.user}
          userId={boost.userId}
          customPeer={!boost.userId ? CUSTOM_PEER_TO_BE_DISTRIBUTED : undefined}
          status={lang('BoostExpireOn', formatDateAtTime(lang, boost.expires * 1000))}
          noEmojiStatus
          forceShowSelf
          noFake
          noVerified
          iconElement={boost.multiplier ? renderBoostIcon(boost.multiplier) : undefined}
          rightElement={renderBoostTypeIcon(boost)}
        />
      </ListItem>
    );
  });

  const handleGiveawayClick = useLastCallback(() => {
    openGiveawayModal({ chatId });
  });

  const handleLoadMore = useLastCallback(() => {
    loadMoreBoosters({ isGifts: tabType === 'giftedBoostList' });
  });

  const launchPrepaidGiveawayHandler = useLastCallback((prepaidGiveaway: ApiPrepaidGiveaway) => {
    openGiveawayModal({ chatId, prepaidGiveaway });
  });

  function renderContent() {
    let listToRender;
    if (tabType === 'boostList') {
      listToRender = boostStatistics?.boosts?.list;
    } else if (tabType === 'giftedBoostList') {
      listToRender = boostStatistics?.giftedBoosts?.list;
    }

    if (listToRender && !listToRender?.length) {
      return undefined;
    }

    return (
      <div className={styles.content}>
        {listToRender?.map((boost) => renderBoostList(boost))}
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.root, 'custom-scroll')}>
      {!isLoaded && <Loading />}
      {isLoaded && statsOverview && (
        <>
          <div className={styles.section}>
            <PremiumProgress
              leftText={lang('BoostsLevel', currentLevel!)}
              rightText={hasNextLevel ? lang('BoostsLevel', currentLevel! + 1) : undefined}
              progress={levelProgress}
              floatingBadgeText={formatInteger(boosts)}
              floatingBadgeIcon="boost"
            />
            <StatisticsOverview className={styles.stats} statistics={statsOverview} type="boost" />
          </div>
          {statsOverview.prepaidGiveaways && (
            <div className={styles.section}>
              <h4 className={styles.sectionHeader} dir={lang.isRtl ? 'rtl' : undefined}>
                {lang('BoostingPreparedGiveaways')}
              </h4>
              {statsOverview?.prepaidGiveaways?.map((prepaidGiveaway) => (
                <ListItem
                  key={prepaidGiveaway.id}
                  className="chat-item-clickable"
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => launchPrepaidGiveawayHandler(prepaidGiveaway)}
                >
                  <div className={buildClassName(styles.status, 'status-clickable')}>
                    <div>
                      <img src={GIVEAWAY_IMG_LIST[prepaidGiveaway.months]} alt="Giveaway" />
                    </div>
                    <div className={styles.info}>
                      <h3>
                        {lang('BoostingTelegramPremiumCountPlural', prepaidGiveaway.quantity)}
                      </h3>
                      <p className={styles.month}>{lang('PrepaidGiveawayMonths', prepaidGiveaway.months)}</p>
                    </div>
                    <div className={styles.quantity}>
                      <div className={buildClassName(styles.floatingBadge,
                        styles.floatingBadgeButtonColor,
                        styles.floatingBadgeButton)}
                      >
                        <Icon name="boost" className={styles.floatingBadgeIcon} />
                        <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                          {prepaidGiveaway.quantity * (giveawayBoostsPerPremium ?? GIVEAWAY_BOOST_PER_PREMIUM)}
                        </div>
                      </div>
                    </div>
                  </div>
                </ListItem>
              ))}
              <p className="text-muted hint" key="links-hint">{lang('BoostingSelectPaidGiveaway')}</p>
            </div>
          )}
          <div className={styles.section}>
            {shouldDisplayGiftList ? (
              <div
                className={styles.boostSection}
              >
                <Transition
                  key={activeKey}
                  ref={transitionRef}
                  name={lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
                  activeKey={activeKey}
                  renderCount={tabs.length}
                  shouldRestoreHeight
                  className="shared-media-transition"
                >
                  {renderContent()}
                </Transition>
                <TabList big activeTab={renderingActiveTab} tabs={tabs} onSwitchTab={setActiveTab} />
              </div>
            ) : (
              <>
                <h4 className={styles.sectionHeader} dir={lang.isRtl ? 'rtl' : undefined}>
                  {lang('BoostingBoostsCount', boostStatistics?.boosts?.count)}
                </h4>
                {!boostStatistics?.boosts?.list?.length && (
                  <div className={styles.noResults}>{lang(isChannel ? 'NoBoostersHint' : 'NoBoostersGroupHint')}
                  </div>
                )}
                {boostStatistics?.boosts?.list?.map((boost) => renderBoostList(boost))}
              </>
            )}
            {Boolean(boostersToLoadCount) && (
              <ListItem
                key="load-more"
                className={styles.showMore}
                disabled={boostStatistics?.isLoadingBoosters}
                onClick={handleLoadMore}
              >
                {boostStatistics?.isLoadingBoosters ? (
                  <Spinner className={styles.loadMoreSpinner} />
                ) : (
                  <Icon name="down" className={styles.down} />
                )}
                {lang('ShowVotes', boostersToLoadCount, 'i')}
              </ListItem>
            )}
          </div>
          <LinkField className={styles.section} link={status!.boostUrl} withShare title={lang('LinkForBoosting')} />
          {isGiveawayAvailable && (
            <div className={styles.section}>
              <ListItem icon="gift" ripple onClick={handleGiveawayClick} className={styles.giveawayButton}>
                {lang('BoostingGetBoostsViaGifts')}
              </ListItem>
              <p className="text-muted hint" key="links-hint">{lang(
                isChannel ? 'BoostingGetMoreBoosts' : 'BoostingGetMoreBoostsGroup',
              )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const boostStatistics = tabState.boostStatistics;
    const isGiveawayAvailable = selectIsGiveawayGiftsPurchaseAvailable(global);
    const chatId = boostStatistics && boostStatistics.chatId;
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const isChannel = chat && isChatChannel(chat);
    const giveawayBoostsPerPremium = global.appConfig?.giveawayBoostsPerPremium;

    return {
      boostStatistics,
      isGiveawayAvailable,
      chatId: chatId!,
      giveawayBoostsPerPremium,
      isChannel,
    };
  },
)(BoostStatistics));
