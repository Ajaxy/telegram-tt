import { memo, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBoost, ApiBoostStatistics, ApiTypePrepaidGiveaway } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { AnimationLevel, CustomPeer } from '../../../types';

import { GIVEAWAY_BOOST_PER_PREMIUM } from '../../../config';
import { isChatChannel } from '../../../global/helpers';
import { selectChat, selectIsGiveawayGiftsPurchaseAvailable, selectTabState } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState.ts';
import buildClassName from '../../../util/buildClassName';
import { formatDateAtTime } from '../../../util/dates/dateFormat';
import { resolveTransitionName } from '../../../util/resolveTransitionName.ts';
import { formatInteger } from '../../../util/textFormat';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
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
import GiftStar from '../../../assets/premium/GiftStar.svg';

type StateProps = {
  boostStatistics: TabState['boostStatistics'];
  isGiveawayAvailable?: boolean;
  chatId: string;
  giveawayBoostsPerPremium?: number;
  isChannel?: boolean;
  animationLevel: AnimationLevel;
};

const GIVEAWAY_IMG_LIST: Partial<Record<number, string>> = {
  3: GiftGreenRound,
  6: GiftBlueRound,
  12: GiftRedRound,
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
  const lang = useOldLang();
  const transitionRef = useRef<HTMLDivElement>();

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
          <div className={styles.floatingBadgeValue}>
            {lang(boost.isFromGiveaway
              ? 'BoostingGiveaway' : 'BoostingGift')}
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
        title: lang('Stars', boost.stars),
      };
    }

    if (!boost.userId) {
      customPeer = CUSTOM_PEER_TO_BE_DISTRIBUTED;
    }

    return (
      <ListItem
        className={buildClassName(styles.boostInfo, 'chat-item-clickable')}
        onClick={() => handleBoosterClick(boost.userId)}
      >
        <PrivateChatInfo
          className={styles.user}
          userId={boost.userId}
          customPeer={customPeer}
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

  const handleLoadMore = useLastCallback((e) => {
    e.preventDefault();
    loadMoreBoosters({ isGifts: tabType === 'giftedBoostList' });
  });

  const launchPrepaidGiveawayHandler = useLastCallback((prepaidGiveaway: ApiTypePrepaidGiveaway) => {
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
      <div className={styles.section}>
        {listToRender?.map((boost) => renderBoostList(boost))}
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.root, 'panel-content custom-scroll')}>
      {!isLoaded && <Loading />}
      {isLoaded && statsOverview && (
        <>
          <div className={styles.section}>
            <PremiumProgress
              leftText={lang('BoostsLevel', currentLevel)}
              rightText={hasNextLevel ? lang('BoostsLevel', currentLevel + 1) : undefined}
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
              {statsOverview?.prepaidGiveaways?.map((prepaidGiveaway) => {
                const isStarsGiveaway = 'stars' in prepaidGiveaway;

                return (
                  <ListItem
                    key={prepaidGiveaway.id}
                    className="chat-item-clickable"

                    onClick={() => launchPrepaidGiveawayHandler(prepaidGiveaway)}
                  >
                    <div className={buildClassName(styles.status, 'status-clickable')}>
                      <div>
                        {isStarsGiveaway
                          ? (
                            <img
                              src={GiftStar}
                              className={styles.giveawayIcon}
                              alt={lang('GiftStar')}
                            />
                          ) : (
                            <img
                              src={GIVEAWAY_IMG_LIST[prepaidGiveaway.months] || GIVEAWAY_IMG_LIST[3]}
                              className={styles.giveawayIcon}
                              alt={lang('Giveaway')}
                            />
                          )}
                      </div>
                      <div className={styles.info}>
                        <h3>
                          {isStarsGiveaway
                            ? lang('Giveaway.Stars.Prepaid.Title', prepaidGiveaway.stars)
                            : lang('BoostingTelegramPremiumCountPlural', prepaidGiveaway.quantity)}
                        </h3>
                        <p className={styles.month}>
                          {
                            isStarsGiveaway ? lang('Giveaway.Stars.Prepaid.Desc', prepaidGiveaway.quantity)
                              : lang('PrepaidGiveawayMonths', prepaidGiveaway.months)
                          }
                        </p>
                      </div>
                      <div className={styles.quantity}>
                        <div className={buildClassName(styles.floatingBadge,
                          styles.floatingBadgeButtonColor,
                          styles.floatingBadgeButton)}
                        >
                          <Icon name="boost" className={styles.floatingBadgeIcon} />
                          <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                            {isStarsGiveaway ? prepaidGiveaway.boosts
                              : prepaidGiveaway.quantity * (giveawayBoostsPerPremium ?? GIVEAWAY_BOOST_PER_PREMIUM)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ListItem>
                );
              })}
              <p className="text-muted hint" key="links-hint">{lang('BoostingSelectPaidGiveaway')}</p>
            </div>
          )}
          <div className={styles.section}>
            {shouldDisplayGiftList ? (
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
                <TabList activeTab={renderingActiveTab} tabs={tabs} onSwitchTab={setActiveTab} />
              </div>
            ) : (
              <>
                <h4 className={styles.sectionHeader} dir={lang.isRtl ? 'rtl' : undefined}>
                  {lang('BoostingBoostsCount', boostStatistics?.boosts?.count)}
                </h4>
                {!boostStatistics?.boosts?.list?.length && (
                  <div className={styles.noResults}>
                    {lang(isChannel ? 'NoBoostersHint' : 'NoBoostersGroupHint')}
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
              <ListItem
                key="load-more"
                icon="gift"
                onClick={handleGiveawayClick}
                className={styles.giveawayButton}
              >
                {lang('BoostingGetBoostsViaGifts')}
              </ListItem>
              <p className="text-muted hint" key="links-hint">
                {lang(
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
