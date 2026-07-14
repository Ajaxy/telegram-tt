import { memo } from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

export type RecordMode = 'voice' | 'video';

type OwnProps = {
  isOpen: boolean;
  onSelectMode: (mode: RecordMode) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const RecordModeMenu = ({
  isOpen, onSelectMode, onClose, onCloseAnimationEnd,
}: OwnProps) => {
  const lang = useLang();
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);

  const handleSelectVoice = useLastCallback(() => onSelectMode('voice'));
  const handleSelectVideo = useLastCallback(() => onSelectMode('video'));

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY="bottom"
      className="fluid"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      <MenuItem icon="microphone-alt" onClick={handleSelectVoice}>
        {lang('AttachAudio')}
      </MenuItem>
      <MenuItem icon="round-video" onClick={handleSelectVideo}>
        {lang('AttachVideoMessage')}
      </MenuItem>
    </Menu>
  );
};

export default memo(RecordModeMenu);
