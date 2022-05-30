import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/environment';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './CustomSendMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  isOpenToBottom?: boolean;
  isSavedMessages?: boolean;
  onSendSilent?: NoneToVoidFunction;
  onSendSchedule?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const CustomSendMenu: FC<OwnProps> = ({
  isOpen,
  isOpenToBottom = false,
  isSavedMessages,
  onSendSilent,
  onSendSchedule,
  onClose,
  onCloseAnimationEnd,
}) => {
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);

  const lang = useLang();

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY={isOpenToBottom ? 'top' : 'bottom'}
      className="CustomSendMenu"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
    >
      {onSendSilent && <MenuItem icon="mute" onClick={onSendSilent}>{lang('SendWithoutSound')}</MenuItem>}
      {onSendSchedule && (
        <MenuItem icon="schedule" onClick={onSendSchedule}>
          {lang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
        </MenuItem>
      )}
    </Menu>
  );
};

export default memo(CustomSendMenu);
