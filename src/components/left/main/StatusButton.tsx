import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiEmojiStatus, ApiSticker } from '../../../api/types';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../../config';
import { selectUser } from '../../../global/selectors';
import { getServerTimeOffset } from '../../../util/serverTime';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useAppLayout from '../../../hooks/useAppLayout';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';

import CustomEmoji from '../../common/CustomEmoji';
import PremiumIcon from '../../common/PremiumIcon';
import CustomEmojiEffect from '../../common/reactions/CustomEmojiEffect';
import Button from '../../ui/Button';
import StatusPickerMenu from './StatusPickerMenu.async';

interface StateProps {
  emojiStatus?: ApiEmojiStatus;
}

const EFFECT_DURATION_MS = 1500;
const EMOJI_STATUS_SIZE = 24;

const StatusButton: FC<StateProps> = ({ emojiStatus }) => {
  const { setEmojiStatus, loadCurrentUser } = getActions();

  // eslint-disable-next-line no-null/no-null
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [shouldShowEffect, markShouldShowEffect, unmarkShouldShowEffect] = useFlag(false);
  const [isEffectShown, showEffect, hideEffect] = useFlag(false);
  const [isStatusPickerOpen, openStatusPicker, closeStatusPicker] = useFlag(false);
  const { isMobile } = useAppLayout();

  const delay = emojiStatus?.until ? emojiStatus.until * 1000 - Date.now() + getServerTimeOffset() * 1000 : undefined;
  useTimeout(loadCurrentUser, delay);

  useEffectWithPrevDeps(([prevEmojiStatus]) => {
    if (shouldShowEffect && emojiStatus && prevEmojiStatus && emojiStatus.documentId !== prevEmojiStatus.documentId) {
      showEffect();
      unmarkShouldShowEffect();
    }
  }, [emojiStatus, shouldShowEffect, showEffect, unmarkShouldShowEffect]);

  const handleEmojiStatusSet = useCallback((sticker: ApiSticker) => {
    markShouldShowEffect();
    setEmojiStatus({ emojiStatus: sticker });
  }, [markShouldShowEffect, setEmojiStatus]);

  useTimeout(hideEffect, isEffectShown ? EFFECT_DURATION_MS : undefined);

  const handleEmojiStatusClick = useCallback(() => {
    openStatusPicker();
  }, [openStatusPicker]);

  return (
    <div className="extra-spacing">
      {Boolean(isEffectShown && emojiStatus) && (
        <CustomEmojiEffect
          reaction={emojiStatus!}
          isLottie
          className="emoji-status-effect"
        />
      )}
      <Button
        round
        ref={buttonRef}
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className="emoji-status"
        onClick={handleEmojiStatusClick}
      >
        {emojiStatus ? (
          <CustomEmoji
            key={emojiStatus.documentId}
            documentId={emojiStatus.documentId}
            size={EMOJI_STATUS_SIZE}
            loopLimit={EMOJI_STATUS_LOOP_LIMIT}
          />
        ) : <PremiumIcon />}
      </Button>
      <StatusPickerMenu
        statusButtonRef={buttonRef}
        isOpen={isStatusPickerOpen}
        onEmojiStatusSelect={handleEmojiStatusSet}
        onClose={closeStatusPicker}
      />
    </div>
  );
};

export default memo(withGlobal((global): StateProps => {
  const { currentUserId } = global;
  const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

  return {
    emojiStatus: currentUser?.emojiStatus,
  };
})(StatusButton));
