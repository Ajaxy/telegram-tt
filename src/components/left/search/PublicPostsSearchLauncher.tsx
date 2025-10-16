import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSearchPostsFlood } from '../../../api/types';

import {
  PUBLIC_POSTS_SEARCH_DEFAULT_STARS_AMOUNT,
  PUBLIC_POSTS_SEARCH_DEFAULT_TOTAL_DAILY,
} from '../../../config';
import { selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { throttle } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import TextTimer from '../../ui/TextTimer';
import Transition from '../../ui/Transition';

import styles from './PublicPostsSearchLauncher.module.scss';

type OwnProps = {
  searchQuery?: string;
  searchFlood?: ApiSearchPostsFlood;
  onSearch: () => void;
  isLoading?: boolean;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
  starsBalance: number;
};

const WAIT_DELAY = 2;
const runThrottled = throttle((cb) => cb(), 500, false);

const PublicPostsSearchLauncher = ({
  searchQuery,
  searchFlood,
  onSearch,
  isLoading,
  isCurrentUserPremium,
  starsBalance,
}: OwnProps & StateProps) => {
  const {
    checkSearchPostsFlood,
    openPremiumModal,
    openStarsBalanceModal,
  } = getActions();

  const lang = useLang();
  const queryIsFree = searchFlood?.queryIsFree;
  const queryFromFlood = searchFlood?.query;

  const searchButtonActiveKey = useTransitionActiveKey([searchQuery?.slice(0, 18).trimEnd()]);

  const handleSearchClick = useLastCallback(() => {
    onSearch();
  });

  useEffect(() => {
    if (queryIsFree && searchQuery && queryFromFlood === searchQuery) {
      onSearch();
    }
  }, [queryIsFree, searchQuery, queryFromFlood, onSearch]);

  const handlePaidSearchClick = useLastCallback(() => {
    const starsAmount = searchFlood?.starsAmount || 0;
    const currentBalance = starsBalance;

    if (currentBalance < starsAmount) {
      openStarsBalanceModal({
        topup: {
          balanceNeeded: starsAmount,
        },
      });
    } else {
      onSearch();
    }
  });

  useEffect(() => {
    if (searchQuery && queryFromFlood !== searchQuery) {
      runThrottled(() => {
        checkSearchPostsFlood({ query: searchQuery });
      });
    }
  }, [searchQuery, queryFromFlood]);

  const onCheckFlood = useLastCallback(() => {
    checkSearchPostsFlood({});
  });

  const handleSubscribePremiumClick = useLastCallback(() => {
    openPremiumModal();
  });

  const renderLimitReached = () => {
    const waitTill = searchFlood?.waitTill;
    const starsAmount = searchFlood?.starsAmount || PUBLIC_POSTS_SEARCH_DEFAULT_STARS_AMOUNT;
    const totalDaily = searchFlood?.totalDaily || PUBLIC_POSTS_SEARCH_DEFAULT_TOTAL_DAILY;

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <AnimatedIconWithPreview
            className={styles.sticker}
            size={120}
            tgsUrl={LOCAL_TGS_URLS.Search}
            previewUrl={LOCAL_TGS_PREVIEW_URLS.Search}
            nonInteractive
            noLoop={false}
          />
          <div className={styles.limitTitle}>
            {lang('PublicPostsLimitReached')}
          </div>
          <div className={styles.limitDescription}>
            {lang('HintPublicPostsSearchQuota', { count: totalDaily }, { pluralValue: totalDaily })}
          </div>
          <Button
            className={styles.paidSearchButton}
            color="primary"
            disabled={!searchQuery}
            noForcedUpperCase
            onClick={handlePaidSearchClick}
          >
            {lang('PublicPostsSearchForStars', {
              stars: formatStarsAsIcon(lang, starsAmount, { asFont: true }),
            }, { withNodes: true })}
          </Button>
          {Boolean(waitTill) && (
            <div className={styles.freeSearchUnlock}>
              <TextTimer
                langKey="UnlockTimerPublicPostsSearch"
                endsAt={waitTill + WAIT_DELAY}
                onEnd={onCheckFlood}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSearchButton = () => {
    const remainingSearches = searchFlood?.remains || 0;

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <AnimatedIconWithPreview
            className={styles.sticker}
            size={120}
            tgsUrl={LOCAL_TGS_URLS.Search}
            previewUrl={LOCAL_TGS_PREVIEW_URLS.Search}
            nonInteractive
            noLoop={false}
          />
          <div className={styles.title}>
            {lang('GlobalSearch')}
          </div>
          <div className={styles.description}>
            {lang('DescriptionPublicPostsSearch')}
          </div>
          <Button
            className={styles.searchButton}
            color="primary"
            noForcedUpperCase
            disabled={!searchQuery}
            onClick={handleSearchClick}
          >
            <Transition
              name="fade"
              activeKey={searchButtonActiveKey}
            >
              <div className={styles.searchButtonContent}>
                <Icon
                  name="search"
                  className={
                    buildClassName(styles.searchIcon,
                      searchQuery && styles.searchIconWithNext)
                  }
                />
                {lang('ButtonSearchPublicPosts', {
                  query: searchQuery ? <span className={styles.searchQuery}>{searchQuery}</span> : '',
                }, { withNodes: true })}
                {searchQuery && <Icon name="next" className={styles.nextIcon} />}
              </div>
            </Transition>
          </Button>
          <div className={styles.remainingSearches}>
            {lang('RemainingPublicPostsSearch', { count: remainingSearches }, { pluralValue: remainingSearches })}
          </div>
        </div>
      </div>
    );
  };

  const renderPremiumRequired = () => {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.premiumTitle}>
            {lang('GlobalSearch')}
          </div>
          <div className={styles.premiumDescription}>
            {lang('PublicPostsPremiumFeatureDescription')}
          </div>
          <Button
            className={styles.subscribePremiumButton}
            color="primary"
            noForcedUpperCase
            onClick={handleSubscribePremiumClick}
          >
            {lang('PublicPostsSubscribeToPremium')}
          </Button>
          <div className={styles.premiumSubtitle}>
            {lang('PublicPostsPremiumFeatureSubtitle')}
          </div>
        </div>
      </div>
    );
  };

  const serverTime = getServerTime();
  const shouldRenderPaidScreen = searchFlood?.remains === 0
    || (searchFlood?.waitTill && searchFlood.waitTill > serverTime);

  const renderLoading = () => {
    return (
      <div className={styles.container}>
        <div className={buildClassName(styles.content, styles.loadingScreen)}>
          <Loading />
        </div>
      </div>
    );
  };

  const getActiveKey = () => {
    if (!isCurrentUserPremium) {
      return 3;
    }
    if (isLoading) {
      return 2;
    }
    if (shouldRenderPaidScreen) {
      return 0;
    }
    return 1;
  };

  const renderContent = () => {
    if (!isCurrentUserPremium) {
      return renderPremiumRequired();
    }
    if (isLoading) {
      return renderLoading();
    }
    if (shouldRenderPaidScreen) {
      return renderLimitReached();
    }
    return renderSearchButton();
  };

  return (
    <Transition
      name="fade"
      activeKey={getActiveKey()}
    >
      {renderContent()}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  isCurrentUserPremium: selectIsCurrentUserPremium(global),
  starsBalance: global.stars?.balance?.amount || 0,
}))(PublicPostsSearchLauncher));
