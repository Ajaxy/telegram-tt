import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

type OwnProps = {
  onCreate: NoneToVoidFunction;
  onImport: NoneToVoidFunction;
};

const WalletReplaceScreen = ({ onCreate, onImport }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen sticker="👛" title={lang('WalletReplaceTitle')}>
      <WalletNoticeActions>
        <Button pill onClick={onCreate}>
          {lang('WalletReplaceCreate')}
        </Button>
        <Button isText pill onClick={onImport}>
          {lang('WalletReplaceImport')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletReplaceScreen);
