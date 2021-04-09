import React, { FC, memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../modules/selectors';
import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaCongratulations: FC<OwnProps & StateProps> = ({
  animatedEmoji, onScreenSelect,
}) => {
  const lang = useLang();

  const handleClick = () => {
    onScreenSelect(SettingsScreens.Privacy);
  };

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} />

        <p className="settings-item-description mb-3">
          {lang('TwoStepVerificationPasswordSetInfo')}
        </p>
      </div>

      <div className="settings-item pt-0 no-border">
        <Button onClick={handleClick}>{lang('TwoStepVerificationPasswordReturnSettings')}</Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🥳'),
  };
})(SettingsTwoFaCongratulations));
