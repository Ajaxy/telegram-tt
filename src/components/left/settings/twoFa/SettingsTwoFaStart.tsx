import { memo } from '../../../../lib/teact/teact';

import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import Button from '../../../ui/Button';

import lockPreviewUrl from '../../../../assets/lock.png';

type OwnProps = {
  onStart: NoneToVoidFunction;
  isActive?: boolean;
  onReset: () => void;
};

const SettingsTwoFaStart = ({
  isActive, onReset, onStart,
}: OwnProps) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={160}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('SetAdditionalPasswordInfo')}
        </p>
      </div>

      <Button onClick={onStart}>{lang('EditAdminTransferSetPassword')}</Button>
    </div>
  );
};

export default memo(SettingsTwoFaStart);
