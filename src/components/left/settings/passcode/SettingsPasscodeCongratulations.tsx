import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';

import { STICKER_SIZE_PASSCODE } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIcon from '../../../common/AnimatedIcon';
import Button from '../../../ui/Button';

type OwnProps = {
  isActive?: boolean;
  onReset: (forceReturnToChatList?: boolean) => void;
};

const SettingsPasscodeCongratulations: FC<OwnProps> = ({
  isActive, onReset,
}) => {
  const lang = useOldLang();

  const fullReset = useCallback(() => {
    onReset(true);
  }, [onReset]);

  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIcon
          size={STICKER_SIZE_PASSCODE}
          tgsUrl={LOCAL_TGS_URLS.Congratulations}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          Congratulations!
        </p>
        <p className="settings-item-description mb-3" dir="auto">
          Now you can lock the app with a passcode so that others can&apos;t open it.
        </p>
      </div>

      <div className="settings-item pt-2">
        <Button onClick={fullReset}>{lang('Back')}</Button>
      </div>
    </div>
  );
};

export default memo(SettingsPasscodeCongratulations);
