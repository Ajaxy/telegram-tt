import React, { memo } from '../../lib/teact/teact';

import type { ApiChat, ApiUser } from '../../api/types';
import type { FC } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../config';
import renderText from './helpers/renderText';
import { getChatTitle, getUserFullName, isUserId } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import VerifiedIcon from './VerifiedIcon';
import FakeIcon from './FakeIcon';
import CustomEmoji from './CustomEmoji';
import PremiumIcon from './PremiumIcon';

import styles from './FullNameTitle.module.scss';

type OwnProps = {
  peer: ApiChat | ApiUser;
  className?: string;
  noVerified?: boolean;
  noFake?: boolean;
  withEmojiStatus?: boolean;
  isSavedMessages?: boolean;
  noLoopLimit?: boolean;
  onEmojiStatusClick?: NoneToVoidFunction;
  observeIntersection?: ObserveFn;
};

const FullNameTitle: FC<OwnProps> = ({
  className,
  peer,
  noVerified,
  noFake,
  withEmojiStatus,
  isSavedMessages,
  noLoopLimit,
  onEmojiStatusClick,
  observeIntersection,
}) => {
  const lang = useLang();
  const isUser = isUserId(peer.id);
  const title = isUser ? getUserFullName(peer as ApiUser) : getChatTitle(lang, peer as ApiChat);
  const emojiStatus = isUser && (peer as ApiUser).emojiStatus;
  const isPremium = isUser && (peer as ApiUser).isPremium;

  if (isSavedMessages) {
    return (
      <div className={buildClassName('title', styles.root, className)}>
        <h3>{lang('SavedMessages')}</h3>
      </div>
    );
  }

  return (
    <div className={buildClassName('title', styles.root, className)}>
      <h3 dir="auto" className="fullName">{renderText(title)}</h3>
      {!noVerified && peer.isVerified && <VerifiedIcon />}
      {!noFake && peer.fakeType && <FakeIcon fakeType={peer.fakeType} />}
      {withEmojiStatus && emojiStatus && (
        <CustomEmoji
          documentId={emojiStatus.documentId}
          loopLimit={!noLoopLimit ? EMOJI_STATUS_LOOP_LIMIT : undefined}
          observeIntersectionForLoading={observeIntersection}
          onClick={onEmojiStatusClick}
        />
      )}
      {withEmojiStatus && !emojiStatus && isPremium && <PremiumIcon />}
    </div>
  );
};

export default memo(FullNameTitle);
