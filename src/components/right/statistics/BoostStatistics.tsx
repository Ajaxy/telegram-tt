import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBoostStatistics, ApiPrepaidGiveaway } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { GIVEAWAY_BOOST_PER_PREMIUM } from '../../../config';
import { isChatChannel } from '../../../global/helpers';
import { selectChat, selectIsGiveawayGiftsPurchaseAvailable, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateAtTime } from '../../../util/date/dateFormat';
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
    openChat, loadMoreBoosters, closeBoostStatistics, openGiveawayModal,
  } = getActions();
  const lang = useLang();

  const isLoaded = boostStatistics?.boostStatus;
  const status = isLoaded ? boostStatistics.boostStatus : undefined;

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

  const boostersToLoadCount = useMemo(() => {
    if (!boostStatistics?.count) return undefined;
    const loadedCount = boostStatistics.boosterIds?.length || 0;
    const totalCount = boostStatistics.count;
    return totalCount - loadedCount;
  }, [boostStatistics]);

  const handleBoosterClick = useLastCallback((userId: string) => {
    openChat({ id: userId });
    closeBoostStatistics();
  });

  const handleGiveawayClick = useLastCallback(() => {
    openGiveawayModal({ chatId });
  });

  const handleLoadMore = useLastCallback(() => {
    loadMoreBoosters();
  });

  const launchPrepaidGiveawayHandler = useLastCallback((prepaidGiveaway: ApiPrepaidGiveaway) => {
    openGiveawayModal({ chatId, prepaidGiveaway });
  });

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
              floatingBadgeText={boosts.toString()}
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
                      <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeButtonColor)}>
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
          {isChannel && (
            <div className={styles.section}>
              <h4 className={styles.sectionHeader} dir={lang.isRtl ? 'rtl' : undefined}>
                {lang('Boosters')}
              </h4>
              {!boostStatistics.boosterIds?.length && (
                <div className={styles.noResults}>{lang('NoBoostersHint')}</div>
              )}
              {boostStatistics.boosterIds?.map((userId) => (
                <ListItem
                  key={userId}
                  className="chat-item-clickable"
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => handleBoosterClick(userId)}
                >
                  <PrivateChatInfo
                    className={styles.user}
                    forceShowSelf
                    userId={userId}
                    status={lang('BoostExpireOn', formatDateAtTime(lang, boostStatistics.boosters![userId] * 1000))}
                  />
                </ListItem>
              ))}
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
                  {lang('ShowVotes', boostersToLoadCount)}
                </ListItem>
              )}
            </div>
          )}
          <LinkField className={styles.section} link={status!.boostUrl} withShare title={lang('LinkForBoosting')} />
          {isGiveawayAvailable && (
            <div className={styles.section}>
              <ListItem icon="gift" ripple onClick={handleGiveawayClick}>
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
