import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiPeer,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { CustomPeer } from '../../types';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../config';
import {
  getChatTitle,
  getUserFullName,
  isAnonymousForwardsChat,
  isChatWithRepliesBot,
  isChatWithVerificationCodesBot,
} from '../../global/helpers';
import { isApiPeerUser } from '../../global/helpers/peers';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { copyTextToClipboard } from '../../util/clipboard';
import stopEvent from '../../util/stopEvent';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Transition from '../ui/Transition';
import CustomEmoji from './CustomEmoji';
import FakeIcon from './FakeIcon';
import StarIcon from './icons/StarIcon';
import VerifiedIcon from './VerifiedIcon';

import styles from './FullNameTitle.module.scss';

type OwnProps = {
  peer: ApiPeer | CustomPeer;
  className?: string;
  noVerified?: boolean;
  noFake?: boolean;
  withEmojiStatus?: boolean;
  emojiStatusSize?: number;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  isMonoforum?: boolean;
  monoforumBadgeClassName?: string;
  noLoopLimit?: boolean;
  canCopyTitle?: boolean;
  iconElement?: React.ReactNode;
  statusSparklesColor?: string;
  onEmojiStatusClick?: NoneToVoidFunction;
  observeIntersection?: ObserveFn;
};

const FullNameTitle: FC<OwnProps> = ({
  className,
  peer,
  noVerified,
  noFake,
  withEmojiStatus,
  emojiStatusSize,
  isSavedMessages,
  isSavedDialog,
  noLoopLimit,
  canCopyTitle,
  iconElement,
  statusSparklesColor,
  isMonoforum,
  monoforumBadgeClassName,
  onEmojiStatusClick,
  observeIntersection,
}) => {
  const { showNotification } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const realPeer = 'id' in peer ? peer : undefined;
  const customPeer = 'isCustomPeer' in peer ? peer : undefined;
  const isUser = realPeer && isApiPeerUser(realPeer);
  const title = realPeer && (isUser ? getUserFullName(realPeer) : getChatTitle(oldLang, realPeer));
  const isPremium = (isUser && realPeer.isPremium) || customPeer?.isPremium;
  const canShowEmojiStatus = withEmojiStatus && !isSavedMessages;
  const emojiStatus = realPeer?.emojiStatus
    || (customPeer?.emojiStatusId ? { type: 'regular', documentId: customPeer.emojiStatusId } : undefined);

  const handleTitleClick = useLastCallback((e) => {
    if (!title || !canCopyTitle) {
      return;
    }

    stopEvent(e);
    copyTextToClipboard(title);
    showNotification({ message: `${isUser ? 'User' : 'Chat'} name was copied` });
  });

  const specialTitle = useMemo(() => {
    if (customPeer) {
      return renderText(customPeer.title || oldLang(customPeer.titleKey!));
    }

    if (isSavedMessages) {
      return oldLang(isSavedDialog ? 'MyNotes' : 'SavedMessages');
    }

    if (isAnonymousForwardsChat(realPeer!.id)) {
      return oldLang('AnonymousForward');
    }

    if (isChatWithRepliesBot(realPeer!.id)) {
      return oldLang('RepliesTitle');
    }

    if (isChatWithVerificationCodesBot(realPeer!.id)) {
      return oldLang('VerifyCodesNotifications');
    }

    return undefined;
  }, [customPeer, isSavedDialog, isSavedMessages, oldLang, realPeer]);
  const botVerificationIconId = realPeer?.botVerificationIconId;

  return (
    <div className={buildClassName('title', styles.root, className)}>
      {botVerificationIconId && (
        <CustomEmoji
          documentId={botVerificationIconId}
          size={emojiStatusSize}
          loopLimit={!noLoopLimit ? EMOJI_STATUS_LOOP_LIMIT : undefined}
          observeIntersectionForLoading={observeIntersection}
        />
      )}
      <h3
        dir="auto"
        role="button"
        className={buildClassName(
          'fullName',
          styles.fullName,
          canCopyTitle && styles.canCopy,
        )}
        onClick={handleTitleClick}
      >
        {specialTitle || renderText(title || '')}
      </h3>
      {!iconElement && peer && (
        <>
          {!noVerified && peer?.isVerified && <VerifiedIcon />}
          {!noFake && peer?.fakeType && <FakeIcon fakeType={peer.fakeType} />}
          {canShowEmojiStatus && emojiStatus && (
            <Transition
              className={styles.statusTransition}
              slideClassName={styles.statusTransitionSlide}
              activeKey={Number(emojiStatus.documentId)}
              name="slideFade"
              direction={-1}
              shouldCleanup
            >
              <CustomEmoji
                forceAlways
                className="no-selection"
                withSparkles={emojiStatus.type === 'collectible'}
                sparklesClassName="statusSparkles"
                sparklesStyle={buildStyle(statusSparklesColor && `color: ${statusSparklesColor}`)}
                documentId={emojiStatus.documentId}
                size={emojiStatusSize}
                loopLimit={!noLoopLimit ? EMOJI_STATUS_LOOP_LIMIT : undefined}
                observeIntersectionForLoading={observeIntersection}
                onClick={onEmojiStatusClick}
              />
            </Transition>
          )}
          {canShowEmojiStatus && !emojiStatus && isPremium && <StarIcon />}
          {isMonoforum && (
            <div className={buildClassName(styles.monoforumBadge, monoforumBadgeClassName)}>
              {lang('MonoforumBadge')}
            </div>
          )}
        </>
      )}
      {iconElement}
    </div>
  );
};

export default memo(FullNameTitle);
