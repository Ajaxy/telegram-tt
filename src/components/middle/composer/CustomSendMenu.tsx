import React, { FC, memo } from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/environment';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './CustomSendMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  onSilentSend?: NoneToVoidFunction;
  onScheduleSend?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const CustomSendMenu: FC<OwnProps> = ({
  isOpen, onSilentSend, onScheduleSend, onClose, onCloseAnimationEnd,
}) => {
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);

  const lang = useLang();

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY="bottom"
      className="CustomSendMenu"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
    >
      {onSilentSend && <MenuItem icon="mute" onClick={onSilentSend}>{lang('SendWithoutSound')}</MenuItem>}
      {onScheduleSend && <MenuItem icon="schedule" onClick={onScheduleSend}>{lang('ScheduleMessage')}</MenuItem>}
    </Menu>
  );
};

export default memo(CustomSendMenu);
