import React, { FC, memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../modules/selectors';
import useLang from '../../../../hooks/useLang';

import ListItem from '../../../ui/ListItem';
import AnimatedEmoji from '../../../common/AnimatedEmoji';
import renderText from '../../../common/helpers/renderText';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaEnabled: FC<OwnProps & StateProps> = ({ animatedEmoji, onScreenSelect }) => {
  const lang = useLang();

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} />

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
