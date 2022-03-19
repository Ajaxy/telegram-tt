import React, { FC, memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import ListItem from '../../../ui/ListItem';
import AnimatedEmoji from '../../../common/AnimatedEmoji';
import renderText from '../../../common/helpers/renderText';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaEnabled: FC<OwnProps & StateProps> = ({
  isActive, onReset, animatedEmoji, onScreenSelect,
}) => {
  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.TwoFaEnabled);

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />

        <p className="settings-item-description mb-3" dir="auto">
          {renderText(lang('EnabledPasswordText'), ['br'])}
        </p>
      </div>

      <div className="settings-item pt-0 no-border">
        <ListItem
          icon="edit"
          onClick={() => onScreenSelect(SettingsScreens.TwoFaChangePasswordCurrent)}
        >
          {lang('ChangePassword')}
        </ListItem>
        <ListItem
          icon="password-off"
          onClick={() => onScreenSelect(SettingsScreens.TwoFaTurnOff)}
        >
          {lang('TurnPasswordOff')}
        </ListItem>
        <ListItem
          icon="email"
          onClick={() => onScreenSelect(SettingsScreens.TwoFaRecoveryEmailCurrentPassword)}
        >
          {lang('SetRecoveryEmail')}
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🔐'),
  };
})(SettingsTwoFaEnabled));
