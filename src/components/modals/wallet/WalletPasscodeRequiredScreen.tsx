import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

type OwnProps = {
  onSetUp: NoneToVoidFunction;
};

const WalletPasscodeRequiredScreen = ({ onSetUp }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen
      sticker="🔒"
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
