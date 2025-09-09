import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';

import { STICKER_SIZE_PASSCODE } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import Button from '../../../ui/Button';

import lockPreviewUrl from '../../../../assets/lock.png';

type OwnProps = {
  isActive?: boolean;
  onStart: NoneToVoidFunction;
  onReset: () => void;
};

const SettingsPasscodeStart: FC<OwnProps> = ({
  isActive, onReset, onStart,
}) => {
  const lang = useLang();

  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={STICKER_SIZE_PASSCODE}
          className="settings-content-icon"
        />

        <p className="settings-item-description" dir="auto">
          {lang('SettingsPasscodeStart1', undefined, { withNodes: true, renderTextFilters: ['br'] })}
        </p>
        <p className="settings-item-description mb-3" dir="auto">
          {lang('SettingsPasscodeStart2', undefined, { withNodes: true, renderTextFilters: ['br'] })}
        </p>
      </div>

      <div className="settings-item settings-group">
        <Button onClick={onStart}>{lang('EnablePasscode')}</Button>
      </div>
    </div>
  );
};

export default memo(SettingsPasscodeStart);
