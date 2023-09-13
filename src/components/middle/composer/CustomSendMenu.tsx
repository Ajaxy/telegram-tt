import type { FC } from '../../../lib/teact/teact';
import React, { memo, useState } from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLang from '../../../hooks/useLang';
import useMouseInside from '../../../hooks/useMouseInside';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

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
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const CustomSendMenu: FC<OwnProps> = ({
  isOpen,
  isOpenToBottom = false,
  isSavedMessages,
  canSchedule,
  canScheduleUntilOnline,
  onSendSilent,
  onSendSchedule,
  onSendWhenOnline,
  onClose,
  onCloseAnimationEnd,
}) => {
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const [displayScheduleUntilOnline, setDisplayScheduleUntilOnline] = useState(false);

  const lang = useLang();

  useEffectWithPrevDeps(([prevIsOpen]) => {
    // Avoid context menu item shuffling when opened
    if (isOpen && !prevIsOpen) {
      setDisplayScheduleUntilOnline(Boolean(canScheduleUntilOnline));
    }
  }, [isOpen, canScheduleUntilOnline]);

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY={isOpenToBottom ? 'top' : 'bottom'}
      className="CustomSendMenu with-menu-transitions"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
    >
      {onSendSilent && <MenuItem icon="mute" onClick={onSendSilent}>{lang('SendWithoutSound')}</MenuItem>}
      {canSchedule && onSendSchedule && (
        <MenuItem icon="schedule" onClick={onSendSchedule}>
          {lang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
        </MenuItem>
      )}
      {canSchedule && onSendSchedule && displayScheduleUntilOnline && (
        <MenuItem icon="user-online" onClick={onSendWhenOnline}>
          {lang('SendWhenOnline')}
        </MenuItem>
      )}
    </Menu>
  );
};

export default memo(CustomSendMenu);
