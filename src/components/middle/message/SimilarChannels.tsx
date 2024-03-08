import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getChatAvatarHash } from '../../../global/helpers';
import {
  selectChat,
  selectIsCurrentUserPremium,
  selectSimilarChannelIds,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getAverageColor, rgb2hex } from '../../../util/colors';
import { formatIntegerCompact } from '../../../util/textFormat';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useFlag from '../../../hooks/useFlag';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

import Avatar from '../../common/Avatar';
import Icon from '../../common/Icon';
import Button from '../../ui/Button';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './SimilarChannels.module.scss';

const DEFAULT_BADGE_COLOR = '#3C3C4399';
const SHOW_CHANNELS_NUMBER = 10;
const MIN_SKELETON_DELAY = 300;
const MAX_SKELETON_DELAY = 2000;

type OwnProps = {
  chatId: string;
};

type StateProps = {
  similarChannelIds?: string[];
  shouldShowInChat?: boolean;
  count: number;
  isCurrentUserPremium: boolean;
};

const SimilarChannels = ({
  chatId,
  similarChannelIds,
  shouldShowInChat,
  count,
  isCurrentUserPremium,
}: StateProps & OwnProps) => {
  const lang = useLang();
  const { toggleChannelRecommendations } = getActions();
  const [isShowing, markShowing, markNotShowing] = useFlag(false);
  const [isHiding, markHiding, markNotHiding] = useFlag(false);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const similarChannels = useMemo(() => {
    if (!similarChannelIds) {
      return undefined;
    }

    const global = getGlobal();
    return similarChannelIds.map((id) => selectChat(global, id)).filter(Boolean);
  }, [similarChannelIds]);
  // Show skeleton while loading similar channels
  const [shoulRenderSkeleton, setShoulRenderSkeleton] = useState(!similarChannelIds);
  const firstSimilarChannels = useMemo(() => similarChannels?.slice(0, SHOW_CHANNELS_NUMBER), [similarChannels]);
  const areSimilarChannelsPresent = Boolean(firstSimilarChannels?.length);
  useHorizontalScroll(ref, !areSimilarChannelsPresent || !shouldShowInChat || shoulRenderSkeleton, true);
  const isAnimating = isHiding || isShowing;
  const shouldRenderChannels = Boolean(
    !shoulRenderSkeleton
      && (shouldShowInChat || isAnimating)
      && areSimilarChannelsPresent,
  );

  useTimeout(() => setShoulRenderSkeleton(false), MAX_SKELETON_DELAY);

  useEffect(() => {
    if (shoulRenderSkeleton && similarChannels && shouldShowInChat) {
      const id = setTimeout(() => {
        setShoulRenderSkeleton(false);
      }, MIN_SKELETON_DELAY);

      return () => clearTimeout(id);
    }

    return undefined;
  }, [similarChannels, shouldShowInChat, shoulRenderSkeleton]);

  const handleToggle = useLastCallback(() => {
    toggleChannelRecommendations({ chatId });
    if (shouldShowInChat) {
      markNotShowing();
      markHiding();
    } else {
      markShowing();
      markNotHiding();
    }
  });

  return (
    <div className={buildClassName(styles.root)}>
      <div className="join-text">
        <span
          className={buildClassName(areSimilarChannelsPresent && styles.joinText)}
          onClick={areSimilarChannelsPresent ? handleToggle : undefined}
        >
          {lang('ChannelJoined')}
        </span>
      </div>
      {shoulRenderSkeleton && <Skeleton className={styles.skeleton} />}
      {shouldRenderChannels && (
        <div
          className={buildClassName(
            isShowing && styles.isAppearing,
            isHiding && styles.isHiding,
          )}
        >
          <div className={styles.notch}>
            <svg
              width="19"
              height="7"
              viewBox="0 0 19 7"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                className={styles.notchPath}
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M19 7C16.8992 7 13.59 3.88897 11.5003 1.67424C10.7648 0.894688 10.397 0.50491 10.0434 0.385149C9.70568 0.270811 9.4225 0.270474 9.08456 0.38401C8.73059 0.50293 8.36133 0.892443 7.62279 1.67147C5.52303 3.88637 2.18302 7 0 7L19 7Z"
                fill="white"
              />
            </svg>
          </div>
          <div className={styles.inner}>
            <div className={styles.header}>
              <span className={styles.title}>{lang('SimilarChannels')}</span>
              <Button
                className={styles.close}
                color="translucent"
                onClick={handleToggle}
              >
                <Icon name="close" />
              </Button>
            </div>
            <div ref={ref} className={buildClassName(styles.channelList, 'no-scrollbar')}>
              {firstSimilarChannels?.map((channel, i) => {
                return i === SHOW_CHANNELS_NUMBER - 1 ? (
                  <MoreChannels
                    channel={channel}
                    chatId={chatId}
                    channelsCount={count - SHOW_CHANNELS_NUMBER + 1}
                    isCurrentUserPremium={isCurrentUserPremium}
                  />
                ) : (
                  <SimilarChannel channel={channel} />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SimilarChannel({ channel }: { channel: ApiChat }) {
  const { openChat } = getActions();
  const color = useAverageColor(channel);

  return (
    <div className={styles.item} onClick={() => openChat({ id: channel.id })}>
      <Avatar className={styles.avatar} key={channel.id} size="large" peer={channel} />
      <div style={`background: ${color}`} className={styles.badge}>
        <i className={buildClassName(styles.icon, 'icon icon-user-filled')} />
        <span className={styles.membersCount}>{formatIntegerCompact(channel?.membersCount || 0)}
        </span>
      </div>
      <span className={styles.channelTitle}>{channel.title}</span>
    </div>
  );
}

function MoreChannels({
  channel,
  chatId,
  channelsCount,
  isCurrentUserPremium,
}: {
  channel: ApiChat;
  chatId: string;
  channelsCount: number;
  isCurrentUserPremium: boolean;
}) {
  const { openPremiumModal, openChatWithInfo } = getActions();
  const lang = useLang();

  const handleClickMore = () => {
    if (isCurrentUserPremium) {
      openChatWithInfo({
        id: chatId, shouldReplaceHistory: true, profileTab: 'similarChannels', forceScrollProfileTab: true,
      });
    } else {
      openPremiumModal();
    }
  };

  return (
    <div
      className={buildClassName(styles.item, styles.lastItem)}
      onClick={() => handleClickMore()}
    >
      <Avatar className={styles.avatar} key={channel.id} size="large" peer={channel} />
      <div className={styles.fakeAvatar}>
        <div className={styles.fakeAvatarInner} />
      </div>
      <div className={buildClassName(styles.fakeAvatar, styles.lastFakeAvatar)}>
        <div className={styles.fakeAvatarInner} />
      </div>
      <div className={styles.badge}>
        <span className={styles.membersCount}>{`+${channelsCount}`}</span>
        {!isCurrentUserPremium && <Icon name="lock-badge" className={styles.icon} />}
      </div>
      <span className={styles.channelTitle}>{lang('MoreSimilar')}</span>
    </div>
  );
}

function useAverageColor(channel: ApiChat) {
  const [color, setColor] = useState(DEFAULT_BADGE_COLOR);
  const imgBlobUrl = useMedia(getChatAvatarHash(channel), false, ApiMediaFormat.BlobUrl);

  useEffect(() => {
    (async () => {
      if (!imgBlobUrl) {
        return;
      }

      const averageColor = await getAverageColor(imgBlobUrl);
      setColor(`#${rgb2hex(averageColor)}`);
    })();
  }, [imgBlobUrl]);

  return color;
}

export default memo(
  withGlobal<OwnProps>((global, { chatId }): StateProps => {
    const { similarChannelIds, shouldShowInChat, count } = selectSimilarChannelIds(global, chatId) || {};
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      similarChannelIds,
      shouldShowInChat,
      count,
      isCurrentUserPremium,
    };
  })(SimilarChannels),
);
