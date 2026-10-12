import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

type OwnProps = {
  onRemove: NoneToVoidFunction;
};

const WalletReleaseKeyScreen = ({ onRemove }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen
      sticker="🔐"
      title={lang('WalletReleaseKeyTitle')}
      text={lang('WalletReleaseKeyText')}
    >
      <WalletNoticeActions>
        <Button color="danger" pill onClick={onRemove}>
          {lang('WalletReleaseKeyRemove')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletReleaseKeyScreen);
