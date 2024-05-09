import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat, ApiPeer, ApiUser } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../config';
import {
  getChatTitle, getUserFullName, isAnonymousForwardsChat, isChatWithRepliesBot, isUserId,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import stopEvent from '../../util/stopEvent';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import CustomEmoji from './CustomEmoji';
import FakeIcon from './FakeIcon';
import PremiumIcon from './PremiumIcon';
import VerifiedIcon from './VerifiedIcon';

import styles from './FullNameTitle.module.scss';

type OwnProps = {
  peer?: ApiPeer;
  className?: string;
  noVerified?: boolean;
  noFake?: boolean;
  withEmojiStatus?: boolean;
  emojiStatusSize?: number;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  noLoopLimit?: boolean;
  isUnknownUser?: boolean;
  canCopyTitle?: boolean;
  onEmojiStatusClick?: NoneToVoidFunction;
  observeIntersection?: ObserveFn;
  iconElement?: React.ReactNode;
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
  onEmojiStatusClick,
  observeIntersection,
  iconElement,
  isUnknownUser,
}) => {
  const lang = useLang();
  const { showNotification } = getActions();
  const isUser = peer && isUserId(peer.id);
  const isPremium = isUser && (peer as ApiUser).isPremium;

  const title = useMemo(() => {
    if (isUnknownUser) {
      return lang('BoostingToBeDistributed');
    }

    if (peer && isUserId(peer.id)) {
      return getUserFullName(peer as ApiUser);
    }

    return peer && getChatTitle(lang, peer as ApiChat);
  }, [isUnknownUser, lang, peer]);

  const handleTitleClick = useLastCallback((e) => {
    if (!title || !canCopyTitle) {
      return;
    }

    stopEvent(e);
    copyTextToClipboard(title);
    showNotification({ message: `${isUser ? 'User' : 'Chat'} name was copied` });
  });

  const specialTitle = useMemo(() => {
    if (isSavedMessages) {
      return lang(isSavedDialog ? 'MyNotes' : 'SavedMessages');
    }

    if (peer && isAnonymousForwardsChat(peer.id)) {
      return lang('AnonymousForward');
    }

    if (peer && isChatWithRepliesBot(peer.id)) {
      return lang('RepliesTitle');
    }

    return undefined;
  }, [isSavedDialog, isSavedMessages, lang, peer]);

  if (specialTitle) {
    return (
      <div className={buildClassName('title', styles.root, className)}>
        <h3>{specialTitle}</h3>
      </div>
    );
  }

  return (
    <div className={buildClassName('title', styles.root, className)}>
      <h3
        dir="auto"
        role="button"
        className={buildClassName('fullName', styles.fullName, canCopyTitle && styles.canCopy)}
        onClick={handleTitleClick}
      >
        {renderText(title || '')}
      </h3>
      {!iconElement && peer && (
        <>
          {!noVerified && peer?.isVerified && <VerifiedIcon />}
          {!noFake && peer?.fakeType && <FakeIcon fakeType={peer.fakeType} />}
          {withEmojiStatus && peer.emojiStatus && (
            <CustomEmoji
              documentId={peer.emojiStatus.documentId}
              size={emojiStatusSize}
              loopLimit={!noLoopLimit ? EMOJI_STATUS_LOOP_LIMIT : undefined}
              observeIntersectionForLoading={observeIntersection}
              onClick={onEmojiStatusClick}
            />
          )}
          {withEmojiStatus && !peer.emojiStatus && isPremium && <PremiumIcon />}
        </>
      )}
      {iconElement}
    </div>
  );
};

export default memo(FullNameTitle);
