import { memo, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBoost, ApiBoostStatistics, ApiTypePrepaidGiveaway } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { AnimationLevel, CustomPeer } from '../../../types';
import type { IconBackdropColor } from '../../gili/primitives/IconBackdrop';

import { GIVEAWAY_BOOST_PER_PREMIUM } from '../../../config';
import { isChatChannel } from '../../../global/helpers';
import { selectChat, selectIsGiveawayGiftsPurchaseAvailable, selectTabState } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState.ts';
import buildClassName from '../../../util/buildClassName';
import { formatCalendarDate, secondsToDate } from '../../../util/localization/dateFormat';
import { resolveTransitionName } from '../../../util/resolveTransitionName.ts';
import { formatInteger } from '../../../util/textFormat';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import BadgeButton from '../../common/BadgeButton';
import Icon from '../../common/icons/Icon';
import LinkField from '../../common/LinkField';
import PremiumProgress from '../../common/PremiumProgress';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Spinner from '../../ui/Spinner';
import SquareTabList from '../../ui/SquareTabList';
import Transition from '../../ui/Transition';
import StatisticsOverview from './StatisticsOverview';

import styles from './BoostStatistics.module.scss';

type StateProps = {
  boostStatistics: TabState['boostStatistics'];
  isGiveawayAvailable?: boolean;
  chatId: string;
  giveawayBoostsPerPremium?: number;
  isChannel?: boolean;
  animationLevel: AnimationLevel;
};

const GIVEAWAY_COLOR_BY_MONTH: Partial<Record<number, IconBackdropColor>> = {
  3: 'green',
  6: 'blue',
  12: 'red',
};

const CUSTOM_PEER_STAR_TEMPLATE: Omit<CustomPeer, 'title' | 'titleKey'> = {
  isCustomPeer: true,
  avatarIcon: 'star',
  peerColorId: 1,
};

const CUSTOM_PEER_TO_BE_DISTRIBUTED: CustomPeer = {
  isCustomPeer: true,
  titleKey: 'BoostingToBeDistributed',
  avatarIcon: 'user',
  withPremiumGradient: true,
};

const BoostStatistics = ({
  boostStatistics,
  isGiveawayAvailable,
  chatId,
  giveawayBoostsPerPremium,
  isChannel,
  animationLevel,
}: StateProps) => {
  const {
    openChat, loadMoreBoosters, closeBoostStatistics, openGiveawayModal, showNotification,
  } = getActions();
  const lang = useLang();
  const transitionRef = useRef<HTMLDivElement>();

  const isLoaded = boostStatistics?.boostStatus;
  const status = isLoaded ? boostStatistics.boostStatus : undefined;

  const isGiftListEqual = boostStatistics && boostStatistics?.boosts?.count
    === boostStatistics?.giftedBoosts?.count;
  const shouldDisplayGiftList = !isGiftListEqual && boostStatistics?.giftedBoosts
    && boostStatistics?.giftedBoosts?.list?.length > 0;
  const boostsCount = boostStatistics?.boosts?.count ?? 0;
  const giftsCount = boostStatistics?.giftedBoosts?.count ?? 0;

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
          title: lang('BoostingBoostsCount', { count: lang.number(boostsCount) }, { pluralValue: boostsCount }),
        },
        {
          type: 'giftedBoostList',
          title: lang('BoostingGiftsCount', { count: lang.number(giftsCount) }, { pluralValue: giftsCount }),
        },
      ];
    }
    return [];
  }, [shouldDisplayGiftList, lang, boostsCount, giftsCount]);

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
          <div className={styles.floatingBadgeValue}>
            {lang(boost.isFromGiveaway ? 'AttachGiveaway' : 'GiftInfoTitle')}
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
    const hasStars = Boolean(boost?.stars);

    let customPeer: CustomPeer | undefined;
    if (hasStars) {
      customPeer = {
        ...CUSTOM_PEER_STAR_TEMPLATE,
        title: lang('StarsAmountText', { amount: boost.stars }, { pluralValue: boost.stars }),
      };
    }

    if (!boost.userId) {
      customPeer = CUSTOM_PEER_TO_BE_DISTRIBUTED;
    }

    return (
      <ListItem
        className="chat-item-clickable"
        onClick={() => handleBoosterClick(boost.userId)}
      >
        <PrivateChatInfo
          className={styles.user}
          userId={boost.userId}
          customPeer={customPeer}
          status={lang('BoostExpireOn', { date: formatCalendarDate(lang, secondsToDate(boost.expires), {
            variant: 'date', isShort: true, withTime: true,
          }) })}
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

  const handleLoadMore = useLastCallback((e) => {
    e.preventDefault();
    loadMoreBoosters({ isGifts: tabType === 'giftedBoostList' });
  });

  const launchPrepaidGiveawayHandler = useLastCallback((prepaidGiveaway: ApiTypePrepaidGiveaway) => {
    openGiveawayModal({ chatId, prepaidGiveaway });
  });

  function renderLoadMore() {
    if (!boostersToLoadCount) return undefined;
    return (
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
        {lang('ShowVotes', { count: lang.number(boostersToLoadCount) }, { pluralValue: boostersToLoadCount })}
      </ListItem>
    );
  }

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
      <Island>
        {listToRender?.map((boost) => renderBoostList(boost))}
        {renderLoadMore()}
      </Island>
    );
  }

  return (
    <div className={buildClassName(styles.root, 'panel-content custom-scroll')}>
      {!isLoaded && <Loading />}
      {isLoaded && statsOverview && (
        <>
          <Island>
            <PremiumProgress
              leftText={lang('BoostsLevel', { level: currentLevel })}
              rightText={hasNextLevel ? lang('BoostsLevel', { level: currentLevel + 1 }) : undefined}
              progress={levelProgress}
              floatingBadgeText={formatInteger(boosts)}
              floatingBadgeIcon="boost"
            />
            <StatisticsOverview className={styles.stats} statistics={statsOverview} type="boost" />
          </Island>
          {statsOverview.prepaidGiveaways && (
            <>
              <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
                {lang('BoostingPreparedGiveaways')}
              </IslandTitle>
              <Island>
                {statsOverview?.prepaidGiveaways?.map((prepaidGiveaway) => {
                  const isStarsGiveaway = 'stars' in prepaidGiveaway;

                  return (
                    <ListItem
                      key={prepaidGiveaway.id}
                      icon={isStarsGiveaway ? 'star' : 'gift-filled'}
                      iconClassName={styles.prepaidIcon}
                      iconBg={isStarsGiveaway ? 'orange'
                        : GIVEAWAY_COLOR_BY_MONTH[prepaidGiveaway.months] || 'green'}
                      multiline
                      rightElement={(
                        <BadgeButton className={styles.boostBadge}>
                          <Icon name="boost" className="in-text-icon" />
                          {isStarsGiveaway ? prepaidGiveaway.boosts
                            : prepaidGiveaway.quantity * (giveawayBoostsPerPremium ?? GIVEAWAY_BOOST_PER_PREMIUM)}
                        </BadgeButton>
                      )}
                      onClick={() => launchPrepaidGiveawayHandler(prepaidGiveaway)}
                    >
                      <span className="title list-item-ellipsis">
                        {isStarsGiveaway
                          ? lang('GiveawayStarsPrepaidTitle', { count: prepaidGiveaway.stars })
                          : lang('BoostingTelegramPremiumCountPlural', {
                            count: prepaidGiveaway.quantity,
                          }, { pluralValue: prepaidGiveaway.quantity })}
                      </span>
                      <span className="subtitle">
                        {isStarsGiveaway ? lang('GiveawayStarsPrepaidDesc', {
                          count: prepaidGiveaway.quantity,
                        }, { pluralValue: prepaidGiveaway.quantity })
                          : lang('PrepaidGiveawayMonths', {
                            count: prepaidGiveaway.months,
                          }, { pluralValue: prepaidGiveaway.months })}
                      </span>
                    </ListItem>
                  );
                })}
              </Island>
              <IslandDescription>{lang('BoostingSelectPaidGiveaway')}</IslandDescription>
            </>
          )}
          {shouldDisplayGiftList ? (
            <Island>
              <div
                className={buildClassName(styles.boostSection, styles.content)}
              >
                <Transition
                  ref={transitionRef}
                  name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
                  activeKey={activeKey}
                  renderCount={tabs.length}
                  shouldRestoreHeight
                >
                  {renderContent()}
                </Transition>
                <SquareTabList activeTab={renderingActiveTab} tabs={tabs} onSwitchTab={setActiveTab} />
              </div>
            </Island>
          ) : (
            <>
              <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
                {lang('BoostingBoostsCount', { count: boostsCount }, { pluralValue: boostsCount })}
              </IslandTitle>
              {!boostStatistics?.boosts?.list?.length ? (
                <IslandDescription>
                  {lang(isChannel ? 'NoBoostersHint' : 'NoBoostersGroupHint')}
                </IslandDescription>
              ) : (
                <Island>
                  {boostStatistics?.boosts?.list?.map((boost) => renderBoostList(boost))}
                  {renderLoadMore()}
                </Island>
              )}
            </>
          )}
          <IslandTitle>{lang('LinkForBoosting')}</IslandTitle>
          <Island>
            <LinkField link={status!.boostUrl} withShare noTitle />
          </Island>
          {isGiveawayAvailable && (
            <>
              <Island>
                <ListItem
                  key="load-more"
                  icon="gift"
                  onClick={handleGiveawayClick}
                >
                  {lang('BoostingGetBoostsViaGifts')}
                </ListItem>
              </Island>
              <IslandDescription>
                {lang(isChannel ? 'BoostingGetMoreBoosts' : 'BoostingGetMoreBoostsGroup')}
              </IslandDescription>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const boostStatistics = tabState.boostStatistics;
    const isGiveawayAvailable = selectIsGiveawayGiftsPurchaseAvailable(global);
    const chatId = boostStatistics && boostStatistics.chatId;
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const isChannel = chat && isChatChannel(chat);
    const giveawayBoostsPerPremium = global.appConfig.giveawayBoostsPerPremium;
    const { animationLevel } = selectSharedSettings(global);

    return {
      boostStatistics,
      isGiveawayAvailable,
      chatId: chatId!,
      giveawayBoostsPerPremium,
      isChannel,
      animationLevel,
    };
  },
)(BoostStatistics));
