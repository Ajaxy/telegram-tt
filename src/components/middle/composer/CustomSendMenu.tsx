import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiReaction,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useOldLang from '../../../hooks/useOldLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import ReactionSelector from '../message/reactions/ReactionSelector';

import './CustomSendMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  isOpenToBottom?: boolean;
  isSavedMessages?: boolean;
  canSchedule?: boolean;
  canScheduleUntilOnline?: boolean;
  onSendSilent?: NoneToVoidFunction;
  onSendSchedule?: NoneToVoidFunction;
  onSendWhenOnline?: NoneToVoidFunction;
  onRemoveEffect?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  chatId?: string;
  withEffects?: boolean;
  hasCurrentEffect?: boolean;
  effectReactions?: ApiReaction[];
  allAvailableReactions?: ApiAvailableReaction[];
  onToggleReaction?: (reaction: ApiReaction) => void;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
  isInSavedMessages?: boolean;
  isInStoryViewer?: boolean;
  canPlayAnimatedEmojis?: boolean;
};

const ANIMATION_DURATION = 200;

const CustomSendMenu: FC<OwnProps> = ({
  isOpen,
  isOpenToBottom = false,
  isSavedMessages,
  canSchedule,
  canScheduleUntilOnline,
  onSendSilent,
  onSendSchedule,
  onSendWhenOnline,
  onRemoveEffect,
  onClose,
  onCloseAnimationEnd,
  chatId,
  withEffects,
  hasCurrentEffect,
  effectReactions,
  allAvailableReactions,
  onToggleReaction,
  canBuyPremium,
  isCurrentUserPremium,
  isInSavedMessages,
  isInStoryViewer,
  canPlayAnimatedEmojis,
}) => {
  const {
    openEffectPicker,
  } = getActions();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const [displayScheduleUntilOnline, setDisplayScheduleUntilOnline] = useState(false);

  const oldLang = useOldLang();
  const lang = useLang();
  const [areItemsHidden, hideItems, showItems] = useFlag();

  useEffectWithPrevDeps(([prevIsOpen]) => {
    // Avoid context menu item shuffling when opened
    if (isOpen && !prevIsOpen) {
      showItems();
      setDisplayScheduleUntilOnline(Boolean(canScheduleUntilOnline));
    }
  }, [isOpen, canScheduleUntilOnline]);

  const [isReady, markIsReady, unmarkIsReady] = useFlag();

  const handleOpenMessageEffectsPicker = useLastCallback((position: IAnchorPosition) => {
    hideItems();
    if (chatId) openEffectPicker({ chatId, position });
  });

  useEffect(() => {
    if (!isOpen) {
      unmarkIsReady();
      return;
    }

    setTimeout(() => {
      markIsReady();
    }, ANIMATION_DURATION);
  }, [isOpen, markIsReady, unmarkIsReady]);

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY={isOpenToBottom ? 'top' : 'bottom'}
      className={buildClassName(
        'CustomSendMenu', 'fluid', 'with-menu-transitions', withEffects && 'with-effects',
      )}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
    >

      {withEffects && !isInStoryViewer && (
        <ReactionSelector
          allAvailableReactions={allAvailableReactions}
          effectReactions={effectReactions}
          currentReactions={undefined}
          onToggleReaction={onToggleReaction!}
          isPrivate
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isInSavedMessages}
          isForEffects
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleOpenMessageEffectsPicker}
          onClose={onClose}
          className={buildClassName(areItemsHidden && 'ReactionSelector-hidden')}
        />
      )}

      <div
        className={buildClassName(
          'CustomSendMenu_items',
          areItemsHidden && 'CustomSendMenu_items-hidden',
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {onSendSilent && <MenuItem icon="mute" onClick={onSendSilent}>{oldLang('SendWithoutSound')}</MenuItem>}
        {canSchedule && onSendSchedule && (
          <MenuItem icon="schedule" onClick={onSendSchedule}>
            {oldLang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
          </MenuItem>
        )}
        {canSchedule && onSendSchedule && displayScheduleUntilOnline && (
          <MenuItem icon="user-online" onClick={onSendWhenOnline}>
            {oldLang('SendWhenOnline')}
          </MenuItem>
        )}
        {withEffects && hasCurrentEffect && (
          <MenuItem icon="delete" onClick={onRemoveEffect}>
            {lang('RemoveEffect')}
          </MenuItem>
        )}
      </div>
    </Menu>
  );
};

export default memo(CustomSendMenu);
