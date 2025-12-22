import { memo, useCallback, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiEmojiStatusCollectible, ApiEmojiStatusType, ApiSticker } from '../../../api/types';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../../config';
import { selectIsCurrentUserFrozen, selectUser } from '../../../global/selectors';
import { getServerTime } from '../../../util/serverTime';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useAppLayout from '../../../hooks/useAppLayout';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';

import CustomEmoji from '../../common/CustomEmoji';
import GiftEffectWrapper from '../../common/gift/GiftEffectWrapper';
import StarIcon from '../../common/icons/StarIcon';
import CustomEmojiEffect from '../../common/reactions/CustomEmojiEffect';
import Button from '../../ui/Button';
import StatusPickerMenu from './StatusPickerMenu.async';

interface StateProps {
  emojiStatus?: ApiEmojiStatusType;
  collectibleStatuses?: ApiEmojiStatusType[];
  isAccountFrozen?: boolean;
}

const EFFECT_DURATION_MS = 1500;
const EMOJI_STATUS_SIZE = 24;

const StatusButton = ({ emojiStatus, collectibleStatuses, isAccountFrozen }: StateProps) => {
  const { setEmojiStatus, loadCurrentUser, openFrozenAccountModal } = getActions();

  const buttonRef = useRef<HTMLButtonElement>();
  const [shouldShowEffect, markShouldShowEffect, unmarkShouldShowEffect] = useFlag(false);
  const [isEffectShown, showEffect, hideEffect] = useFlag(false);
  const [isStatusPickerOpen, openStatusPicker, closeStatusPicker] = useFlag(false);
  const { isMobile } = useAppLayout();

  const collectibleEmojiStatus = emojiStatus?.type === 'collectible' ? emojiStatus : undefined;

  const delay = emojiStatus?.until ? (emojiStatus.until - getServerTime()) * 1000 : undefined;
  useTimeout(loadCurrentUser, delay);

  useEffectWithPrevDeps(([prevEmojiStatus]) => {
    if (shouldShowEffect && emojiStatus && emojiStatus.documentId !== prevEmojiStatus?.documentId) {
      showEffect();
      unmarkShouldShowEffect();
    }
  }, [emojiStatus, shouldShowEffect, showEffect, unmarkShouldShowEffect]);

  const handleEmojiStatusSet = useCallback((sticker: ApiSticker) => {
    const collectibleStatus = collectibleStatuses?.find(
      (status) => 'collectibleId' in status && status.documentId === sticker.id,
    ) as ApiEmojiStatusCollectible | undefined;
    markShouldShowEffect();
    setEmojiStatus({
      emojiStatus: collectibleStatus || { type: 'regular', documentId: sticker.id },
    });
  }, [markShouldShowEffect, setEmojiStatus, collectibleStatuses]);

  useTimeout(hideEffect, isEffectShown ? EFFECT_DURATION_MS : undefined);

  const handleEmojiStatusClick = useCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    openStatusPicker();
  }, [openStatusPicker, isAccountFrozen]);

  return (
    <div className="StatusButton extra-spacing">
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
          <GiftEffectWrapper
            withSparkles={Boolean(collectibleEmojiStatus)}
            sparklesClassName="statusSparkles"
            sparklesColor={collectibleEmojiStatus?.textColor}
          >
            <CustomEmoji
              key={emojiStatus.documentId}
              documentId={emojiStatus.documentId}
              size={EMOJI_STATUS_SIZE}
              loopLimit={EMOJI_STATUS_LOOP_LIMIT}
            />
          </GiftEffectWrapper>
        ) : <StarIcon />}
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

export default memo(withGlobal((global): Complete<StateProps> => {
  const { currentUserId } = global;
  const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;
  const collectibleStatuses = global.collectibleEmojiStatuses?.statuses;
  const isAccountFrozen = selectIsCurrentUserFrozen(global);

  return {
    emojiStatus: currentUser?.emojiStatus,
    collectibleStatuses,
    isAccountFrozen,
  };
})(StatusButton));
