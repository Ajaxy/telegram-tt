import type { TeactNode } from '../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../lib/teact/teact';

import type { ApiTypingStatus } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { LangFn } from '../../util/localization';

import { getPeerTitle } from '../../global/helpers/peers';
import { selectPeer } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import { REM } from './helpers/mediaDimensions';

import { useShallowSelector } from '../../hooks/data/useSelector';
import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';

import styles from './TypingStatus.module.scss';

type OwnProps = {
  typingStatusByPeerId: Record<string, ApiTypingStatus>;
  isPrivate?: boolean;
};

const ICON_SIZE = 1.125 * REM;
const EYES_ICON_SIZE = 1.25 * REM;

const TypingStatus = ({ typingStatusByPeerId, isPrivate }: OwnProps) => {
  const lang = useLang();
  const actionFallbackUser = lang('ActionFallbackUser');
  const typingPeerIds = useMemo(() => Object.keys(typingStatusByPeerId), [typingStatusByPeerId]);

  const sortedTypingStatuses = useMemo(
    () => Object.entries(typingStatusByPeerId).sort(([, a], [, b]) => b.timestamp - a.timestamp),
    [typingStatusByPeerId],
  );

  const latestTypingStatusEntry = sortedTypingStatuses[0];
  const latestPeerId = latestTypingStatusEntry?.[0];
  const latestTypingStatus = latestTypingStatusEntry?.[1];
  const shouldRenderGroupedTyping = typingPeerIds.length >= 2;

  const groupedPeersSelector = useCallback(
    (global: GlobalState) => typingPeerIds.map((peerId) => selectPeer(global, peerId)),
    [typingPeerIds],
  );

  const groupedPeers = useShallowSelector(groupedPeersSelector);
  const latestPeerIndex = latestPeerId ? typingPeerIds.indexOf(latestPeerId) : -1;
  const latestPeer = latestPeerIndex >= 0 ? groupedPeers[latestPeerIndex] : undefined;

  const latestUserName = getTypingPeerName(lang, latestPeer, actionFallbackUser);
  const groupedUserNames = useMemo(
    () => typingPeerIds
      .map((peerId, index) => ({
        peerId,
        name: getTypingPeerName(lang, groupedPeers[index], actionFallbackUser),
      }))
      .sort(compareTypingPeerNames)
      .map(({ name }) => name),
    [actionFallbackUser, groupedPeers, typingPeerIds, lang],
  );

  if (!latestTypingStatus) {
    return undefined;
  }

  const user = latestUserName;
  let content: string | TeactNode;

  if (shouldRenderGroupedTyping) {
    if (sortedTypingStatuses.length === 2) {
      content = lang('UserTypingSeveral', {
        users: lang.conjunction([
          groupedUserNames[0] || actionFallbackUser,
          groupedUserNames[1] || actionFallbackUser,
        ]),
      }, { withNodes: true });
    } else {
      content = lang('UserTypingMany', {
        user: groupedUserNames[0] || actionFallbackUser,
        count: lang.number(sortedTypingStatuses.length - 1),
      }, { withNodes: true, pluralValue: sortedTypingStatuses.length - 1 });
    }
  } else if (isPrivate) {
    content = getPrivateTypingStatusContent(lang, latestTypingStatus);
  } else {
    content = getGroupTypingStatusContent(lang, latestTypingStatus, user);
  }

  const shouldRenderTypingStatusIcon = shouldRenderGroupedTyping || shouldRenderTypingIcon(latestTypingStatus);

  return (
    <span className={buildClassName(styles.typingStatus, 'typing-status')} dir={lang.isRtl ? 'rtl' : 'auto'}>
      {shouldRenderTypingStatusIcon && (
        <AnimatedIconWithPreview
          className={styles.typingIcon}
          tgsUrl={LOCAL_TGS_URLS.Typing}
          size={ICON_SIZE}
          play
          noLoop={false}
          shouldUseTextColor
        />
      )}
      <span className={styles.content} dir="auto">{content}</span>
    </span>
  );
};

function renderEyesIcon() {
  return (
    <AnimatedIconWithPreview
      className={styles.eyesIcon}
      tgsUrl={LOCAL_TGS_URLS.Eyes}
      size={EYES_ICON_SIZE}
      play
      noLoop={false}
      shouldUseTextColor
    />
  );
}

function getPrivateTypingStatusContent(lang: LangFn, typingStatus: ApiTypingStatus) {
  switch (typingStatus.type) {
    case 'recordVideo':
      return lang('SendActionRecordVideo');
    case 'uploadVideo':
      return lang('SendActionUploadVideo');
    case 'recordAudio':
      return lang('SendActionRecordAudio');
    case 'uploadAudio':
      return lang('SendActionUploadAudio');
    case 'uploadPhoto':
      return lang('SendActionUploadPhoto');
    case 'uploadFile':
      return lang('SendActionUploadFile');
    case 'playingGame':
      return lang('PlayingGame');
    case 'recordRound':
      return lang('SendActionRecordRound');
    case 'uploadRound':
      return lang('SendActionUploadRound');
    case 'chooseSticker':
      return lang('SendActionChooseSticker', { eyes: renderEyesIcon() }, { withNodes: true });
    case 'watchingAnimations':
      return lang('ActionWatchingAnimations', { emoji: typingStatus.emoji });
    case 'typing':
    case 'chooseLocation':
    case 'chooseContact':
    default:
      return lang('Typing');
  }
}

function getGroupTypingStatusContent(lang: LangFn, typingStatus: ApiTypingStatus, user: string) {
  switch (typingStatus.type) {
    case 'recordVideo':
      return lang('UserActionRecordVideo', { user }, { withNodes: true });
    case 'uploadVideo':
      return lang('UserActionUploadVideo', { user }, { withNodes: true });
    case 'recordAudio':
      return lang('UserActionRecordAudio', { user }, { withNodes: true });
    case 'uploadAudio':
      return lang('UserActionUploadAudio', { user }, { withNodes: true });
    case 'uploadPhoto':
      return lang('UserActionUploadPhoto', { user }, { withNodes: true });
    case 'uploadFile':
      return lang('UserActionUploadFile', { user }, { withNodes: true });
    case 'playingGame':
      return lang('UserPlayingGame', { user }, { withNodes: true });
    case 'recordRound':
      return lang('UserActionRecordRound', { user }, { withNodes: true });
    case 'uploadRound':
      return lang('UserActionUploadRound', { user }, { withNodes: true });
    case 'chooseSticker':
      return lang('UserActionChooseSticker', { user, eyes: renderEyesIcon() }, { withNodes: true });
    case 'chooseLocation':
    case 'chooseContact':
    case 'typing':
    default:
      return lang('UserTyping', { user }, { withNodes: true });
  }
}

function shouldRenderTypingIcon(typingStatus: ApiTypingStatus) {
  return typingStatus.type === 'typing'
    || typingStatus.type === 'chooseLocation'
    || typingStatus.type === 'chooseContact';
}

function getTypingPeerName(lang: LangFn, peer: ReturnType<typeof selectPeer>, fallback: string) {
  const title = peer ? getPeerTitle(lang, peer) : undefined;

  return title || fallback;
}

function compareTypingPeerNames(
  a: { peerId: string; name: string },
  b: { peerId: string; name: string },
) {
  return a.name.localeCompare(b.name) || a.peerId.localeCompare(b.peerId);
}

export default memo(TypingStatus);
