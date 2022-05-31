import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import ListItem from '../../../ui/ListItem';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsPasscodeEnabled: FC<OwnProps & StateProps> = ({
  isActive, onReset, animatedEmoji, onScreenSelect,
}) => {
  const lang = useLang();

  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />

        <p className="settings-item-description mb-3" dir="auto">
          Local passcode is enabled.
        </p>
      </div>

      <div className="settings-item pt-0">
        <ListItem
          icon="edit"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PasscodeChangePasscodeCurrent)}
        >
          {lang('Passcode.Change')}
        </ListItem>
        <ListItem
          icon="password-off"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PasscodeTurnOff)}
        >
          {lang('Passcode.TurnOff')}
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🔐'),
  };
})(SettingsPasscodeEnabled));
