import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import Island from '@gili/layout/Island';

import styles from './WalletPhraseScreen.module.scss';

type OwnProps = {
  mnemonic?: string[];
  onDone: NoneToVoidFunction;
};

const WalletPhraseScreen = ({ mnemonic, onDone }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen
      sticker="📝"
      title={lang('WalletYourRecoveryPhrase')}
      text={lang('WalletRecoveryPhraseSubtitle')}
    >
      <Island className={styles.words}>
        {mnemonic?.map((word, index) => (
          <div key={index} className={styles.word}>
            <span className={styles.wordNumber}>{`${index + 1}.`}</span>
            {word}
          </div>
        ))}
      </Island>
      <WalletNoticeActions>
        <Button pill onClick={onDone}>{lang('Done')}</Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletPhraseScreen);
