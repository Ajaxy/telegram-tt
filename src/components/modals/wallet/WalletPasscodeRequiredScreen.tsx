import { memo } from '../../../lib/teact/teact';

import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

import styles from './WalletPasscodeRequiredScreen.module.scss';

import lockPreviewUrl from '../../../assets/lock.png';

type OwnProps = {
  onSetUp: NoneToVoidFunction;
};

const STICKER_SIZE = 100;

const WalletPasscodeRequiredScreen = ({ onSetUp }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen
      sticker={(
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={STICKER_SIZE}
          className={styles.sticker}
        />
      )}
      title={lang('WalletPasscodeRequiredTitle')}
      text={lang('WalletPasscodeRequiredText')}
    >
      <WalletNoticeActions>
        <Button pill onClick={onSetUp}>
          {lang('WalletPasscodeRequiredSetUp')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletPasscodeRequiredScreen);
