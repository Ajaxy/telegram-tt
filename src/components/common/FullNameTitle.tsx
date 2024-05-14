import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiChat, ApiPeer, ApiUser,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { CustomPeer } from '../../types';

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
  peer: ApiPeer | CustomPeer;
  className?: string;
  noVerified?: boolean;
  noFake?: boolean;
  withEmojiStatus?: boolean;
  emojiStatusSize?: number;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  noLoopLimit?: boolean;
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
}) => {
  const lang = useLang();
  const { showNotification } = getActions();
  const realPeer = 'id' in peer ? peer : undefined;
  const customPeer = 'isCustomPeer' in peer ? peer : undefined;
  const isUser = realPeer && isUserId(realPeer.id);
  const title = realPeer && (isUser ? getUserFullName(realPeer as ApiUser) : getChatTitle(lang, realPeer as ApiChat));
  const isPremium = isUser && (peer as ApiUser).isPremium;

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
      return lang(customPeer.titleKey);
    }

    if (isSavedMessages) {
      return lang(isSavedDialog ? 'MyNotes' : 'SavedMessages');
    }

    if (isAnonymousForwardsChat(realPeer!.id)) {
      return lang('AnonymousForward');
    }

    if (isChatWithRepliesBot(realPeer!.id)) {
      return lang('RepliesTitle');
    }

    return undefined;
  }, [customPeer, isSavedDialog, isSavedMessages, lang, realPeer]);

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
          {!noVerified && realPeer?.isVerified && <VerifiedIcon />}
          {!noFake && realPeer?.fakeType && <FakeIcon fakeType={realPeer.fakeType} />}
          {withEmojiStatus && realPeer?.emojiStatus && (
            <CustomEmoji
              documentId={realPeer.emojiStatus.documentId}
              size={emojiStatusSize}
              loopLimit={!noLoopLimit ? EMOJI_STATUS_LOOP_LIMIT : undefined}
              observeIntersectionForLoading={observeIntersection}
              onClick={onEmojiStatusClick}
            />
          )}
          {withEmojiStatus && !realPeer?.emojiStatus && isPremium && <PremiumIcon />}
        </>
      )}
      {iconElement}
    </div>
  );
};

export default memo(FullNameTitle);
