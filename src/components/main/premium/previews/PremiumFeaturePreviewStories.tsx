import React, { memo, useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiUser } from '../../../../api/types';

import { selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import useLang from '../../../../hooks/useLang';
import useScrolledState from '../../../../hooks/useScrolledState';
import useDevicePixelRatio from '../../../../hooks/window/useDevicePixelRatio';

import Avatar from '../../../common/Avatar';
import { drawGradientCircle } from '../../../common/AvatarStoryCircle';
import PremiumFeatureItem from '../PremiumFeatureItem';

import styles from './PremiumFeaturePreviewStories.module.scss';

type StateProps = {
  currentUser: ApiUser;
};

const STORY_FEATURE_TITLES = {
  stories_order: 'PremiumStoriesPriority',
  stories_stealth: 'PremiumStoriesStealth',
  stories_views: 'PremiumStoriesViews',
  stories_timer: 'lng_premium_stories_subtitle_expiration',
  stories_save: 'PremiumStoriesSaveToGallery',
  stories_caption: 'lng_premium_stories_subtitle_caption',
  stories_link: 'lng_premium_stories_subtitle_links',
};

const STORY_FEATURE_DESCRIPTIONS = {
  stories_order: 'PremiumStoriesPriorityDescription',
  stories_stealth: 'PremiumStoriesStealthDescription',
  stories_views: 'PremiumStoriesViewsDescription',
  stories_timer: 'PremiumStoriesExpirationDescription',
  stories_save: 'PremiumStoriesSaveToGalleryDescription',
  stories_caption: 'PremiumStoriesCaptionDescription',
  stories_link: 'PremiumStoriesFormattingDescription',
};

const STORY_FEATURE_ICONS = {
  stories_order: 'story-priority',
  stories_stealth: 'eye-closed-outline',
  stories_views: 'eye-outline',
  stories_timer: 'timer',
  stories_save: 'arrow-down-circle',
  stories_caption: 'story-caption',
  stories_link: 'link-badge',
};

const STORY_FEATURE_ORDER = Object.keys(STORY_FEATURE_TITLES) as (keyof typeof STORY_FEATURE_TITLES)[];

const CIRCLE_SIZE = 5.25 * REM;
const CIRCLE_SEGMENTS = 8;
const CIRCLE_READ_SEGMENTS = 0;

const PremiumFeaturePreviewVideo = ({
  currentUser,
}: StateProps) => {
  // eslint-disable-next-line no-null/no-null
  const circleRef = useRef<HTMLCanvasElement>(null);

  const lang = useLang();

  const dpr = useDevicePixelRatio();

  useLayoutEffect(() => {
    if (!circleRef.current) {
      return;
    }

    drawGradientCircle({
      canvas: circleRef.current,
      size: CIRCLE_SIZE * dpr,
      segmentsCount: CIRCLE_SEGMENTS,
      color: 'purple',
      readSegmentsCount: CIRCLE_READ_SEGMENTS,
      readSegmentColor: 'transparent',
      dpr,
    });
  }, [dpr]);

  const { handleScroll, isAtBeginning } = useScrolledState();

  const maxSize = CIRCLE_SIZE;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Avatar forPremiumPromo peer={currentUser} size="giant" />
        <canvas className={styles.circle} ref={circleRef} style={`max-width: ${maxSize}px; max-height: ${maxSize}px`} />
      </div>
      <div className={styles.title}>{lang('UpgradedStories')}</div>
      <div
        className={buildClassName(styles.features, !isAtBeginning && styles.scrolled, 'custom-scroll')}
        onScroll={handleScroll}
      >
        {STORY_FEATURE_ORDER.map((section, index) => {
          return (
            <PremiumFeatureItem
              key={section}
              title={lang(STORY_FEATURE_TITLES[section])}
              text={lang(STORY_FEATURE_DESCRIPTIONS[section])}
              icon={STORY_FEATURE_ICONS[section]}
              isFontIcon
              index={index}
              count={STORY_FEATURE_ORDER.length}
              section={section}
            />
          );
        })}
        <div className={styles.mobile}>{lang('lng_premium_stories_about_mobile')}</div>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      currentUser: selectUser(global, global.currentUserId!)!,
    };
  },
)(PremiumFeaturePreviewVideo));
