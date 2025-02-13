import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import { SettingsScreens } from '../../../../types';

import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import ListItem from '../../../ui/ListItem';

import lockPreviewUrl from '../../../../assets/lock.png';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

const SettingsPasscodeEnabled: FC<OwnProps> = ({
  isActive, onReset, onScreenSelect,
}) => {
  const lang = useOldLang();

  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={160}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          Local passcode is enabled.
        </p>
      </div>

      <div className="settings-item pt-2">
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

export default memo(SettingsPasscodeEnabled);
