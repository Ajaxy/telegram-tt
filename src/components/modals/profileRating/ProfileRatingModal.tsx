import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarsRating, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectUser, selectUserFullInfo } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatShortDuration } from '../../../util/dates/dateFormat';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import PremiumProgress, { type AnimationDirection } from '../../common/PremiumProgress';
import Button from '../../ui/Button';
import Transition from '../../ui/Transition';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './ProfileRatingModal.module.scss';

export type OwnProps = {
  modal: TabState['profileRatingModal'];
};

type StateProps = {
  user?: ApiUser;
  currentUserId?: string;
  starsRating?: ApiStarsRating;
  pendingRating?: ApiStarsRating;
  pendingRatingDate?: number;
};

const ProfileRatingModal = ({
  modal,
  user,
  currentUserId,
  starsRating,
  pendingRating,
  pendingRatingDate,
}: OwnProps & StateProps) => {
  const {
    closeProfileRatingModal,
  } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);
  const [showFutureRating, setShowFutureRating] = useState(false);

  const handleClose = useLastCallback(() => {
    closeProfileRatingModal();
  });

  useEffect(() => {
    if (!isOpen) {
      setShowFutureRating(false);
    }
  }, [isOpen]);

  const handleShowFuture = useLastCallback(() => {
    setShowFutureRating(true);
  });

  const handleShowCurrent = useLastCallback(() => {
    setShowFutureRating(false);
  });

  const renderBadge = (type: 'added' | 'deducted') => {
    const isAdded = type === 'added';
    const badgeText = isAdded ? lang('RatingBadgeAdded') : lang('RatingBadgeDeducted');
    const badgeClass = isAdded ? styles.badgeAdded : styles.badgeDeducted;

    return (
      <span className={buildClassName(styles.badge, badgeClass)}>
        {badgeText}
      </span>
    );
  };

  const header = useMemo(() => {
    if (!modal || !user || !starsRating || !isOpen) return undefined;

    const rating = showFutureRating && pendingRating ? pendingRating : starsRating;
    const currentStars = rating.stars;
    const currentLevelStars = rating.currentLevelStars;
    const nextLevelStars = rating.nextLevelStars;
    const currentLevel = rating.level;
    const nextLevel = currentLevel + 1;
    const isNegative = currentLevel < 0;
    const pendingLevel = !showFutureRating && pendingRating ? pendingRating.level : starsRating.level;

    let levelProgress = 0;

    if (!nextLevelStars) {
      levelProgress = 1;
    } else if (nextLevelStars > currentLevelStars) {
      levelProgress = Math.max(0.03, (currentStars - currentLevelStars) / (nextLevelStars - currentLevelStars));
    } else {
      levelProgress = 1;
    }

    const progress = isNegative ? 0.5 : Math.max(0, Math.min(1, levelProgress));

    const waitTime = pendingRatingDate ? pendingRatingDate - Math.floor(Date.now() / 1000) : 0;
    const pendingPoints = pendingRating ? pendingRating.stars - starsRating.stars : 0;
    const shouldShowPreview = pendingRating && pendingRatingDate;

    const renderPreviewDescription = () => {
      if (!shouldShowPreview) return undefined;

      return (
        <Transition
          name="fade"
          className={buildClassName(styles.descriptionPreview, isNegative && styles.negative)}
          activeKey={showFutureRating ? 1 : 0}
          shouldCleanup
          shouldRestoreHeight
        >
          {showFutureRating ? (
            <p>
              {lang('DescriptionFutureRating', {
                time: formatShortDuration(lang, waitTime),
                points: Math.abs(pendingPoints),
                link: (
                  <span className={styles.backLink} onClick={handleShowCurrent}>
                    {lang('LinkDescriptionRatingBack')}
                  </span>
                ),
              }, {
                pluralValue: Math.abs(pendingPoints),
                withNodes: true,
              })}
            </p>
          ) : (
            <p>
              {lang('DescriptionPendingRating', {
                time: formatShortDuration(lang, waitTime),
                points: Math.abs(pendingPoints),
                link: (
                  <span className={styles.previewLink} onClick={handleShowFuture}>
                    {lang('LinkDescriptionRatingPreview')}
                  </span>
                ),
              }, {
                pluralValue: Math.abs(pendingPoints),
                withNodes: true,
              })}
            </p>
          )}
        </Transition>
      );
    };

    let animationDirection: AnimationDirection = 'none';
    if (currentLevel >= 0 && pendingLevel >= 0 && currentLevel !== pendingLevel) {
      animationDirection = currentLevel > pendingLevel ? 'forward' : 'backward';
    }

    if (currentLevel < 0 && pendingLevel < 0 && currentLevel !== pendingLevel) {
      animationDirection = currentLevel < pendingLevel ? 'backward' : 'forward';
    }

    const userFallbackText = lang('ActionFallbackUser');

    return (
      <div className={styles.header}>
        <PremiumProgress
          leftText={isNegative ? undefined : lang('RatingLevel', { level: currentLevel })}
          rightText={isNegative ? lang('RatingNegativeLevel') : lang('RatingLevel', { level: nextLevel })}
          floatingBadgeIcon={isNegative ? 'warning' : 'crown-wear'}
          floatingBadgeText={isNegative ? currentLevel.toString()
            : `${lang.number(currentStars)} / ${lang.number(nextLevelStars || currentStars)}`}
          progress={progress}
          isPrimary={currentLevel >= 0}
          isNegative={currentLevel < 0}
          animationDirection={animationDirection}
          className={buildClassName(styles.ratingProgress, shouldShowPreview && styles.withPreview)}
        />
        {renderPreviewDescription()}
        <div className={styles.title}>
          {lang('TitleRating')}
        </div>
        <p className={styles.description}>
          {user?.id === currentUserId
            ? lang('RatingYourReflectsActivity')
            : lang('RatingReflectsActivity', { name: getPeerTitle(lang, user) || userFallbackText },
              { withMarkdown: true, withNodes: true })}
        </p>
      </div>
    );
  }, [modal, user, currentUserId, starsRating,
    pendingRating, pendingRatingDate, showFutureRating,
    lang, handleShowFuture, handleShowCurrent, isOpen]);

  const listItemData = [
    ['closed-gift', lang('RatingGiftsFromTelegram'), (
      <span className={styles.subtitle}>
        {renderBadge('added')}
        {lang('RatingGiftsFromTelegramDesc')}
      </span>
    )],
    ['user-stars', lang('RatingGiftsAndPostsFromUsers'), (
      <span className={styles.subtitle}>
        {renderBadge('added')}
        {lang('RatingGiftsAndPostsFromUsersDesc')}
      </span>
    )],
    ['stars-refund', lang('RatingRefundsAndConversions'), (
      <span className={styles.subtitle}>
        {renderBadge('deducted')}
        {lang('RatingRefundsAndConversionsDesc')}
      </span>
    )],
  ] satisfies TableAboutData;

  const footer = useMemo(() => {
    if (!isOpen) return undefined;
    return (
      <div className={styles.footer}>
        <Button
          onClick={handleClose}
        >
          <Icon name="understood" className={styles.understoodIcon} />
          {lang('ButtonUnderstood')}
        </Button>
      </div>
    );
  }, [lang, isOpen, handleClose]);

  return (
    <TableAboutModal
      contentClassName={styles.content}
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const currentUserId = global.currentUserId;
    const user = modal?.userId ? selectUser(global, modal.userId) : undefined;
    const userFullInfo = modal?.userId
      ? selectUserFullInfo(global, modal.userId) : undefined;

    const starsRating = userFullInfo?.starsRating;
    const pendingRating = userFullInfo?.starsMyPendingRating;
    const pendingRatingDate = userFullInfo?.starsMyPendingRatingDate;

    return {
      user,
      currentUserId,
      starsRating,
      pendingRating,
      pendingRatingDate,
    };
  },
)(ProfileRatingModal));
