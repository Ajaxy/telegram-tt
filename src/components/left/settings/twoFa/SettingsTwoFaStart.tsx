import React, { FC, memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../modules/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  onStart: NoneToVoidFunction;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaStart: FC<OwnProps & StateProps> = ({
  isActive, onScreenSelect, onReset, animatedEmoji, onStart,
}) => {
  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.TwoFaDisabled);

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('SetAdditionalPasswordInfo')}
        </p>
      </div>

      <div className="settings-item pt-0 no-border">
        <Button onClick={onStart}>{lang('EditAdminTransferSetPassword')}</Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🔐'),
  };
})(SettingsTwoFaStart));
