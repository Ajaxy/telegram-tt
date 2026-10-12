import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

import styles from './WalletPhraseInfoScreen.module.scss';

type OwnProps = {
  isLoading?: boolean;
  onShow: NoneToVoidFunction;
};

const BULLETS: [IconName, RegularLangKey][] = [
  ['eye', 'WalletPhraseInfoNeverShare'],
  ['unmute', 'WalletPhraseInfoCanSteal'],
  ['check', 'WalletPhraseInfoSupport'],
];

const WalletPhraseInfoScreen = ({ isLoading, onShow }: OwnProps) => {
  const lang = useLang();

  return (
    <WalletNoticeScreen
      sticker="📝"
      title={lang('WalletRecoveryPhraseTitle')}
      text={lang('WalletRecoveryPhraseSubtitle')}
    >
      <div className={styles.bullets}>
        {BULLETS.map(([icon, key]) => (
          <div key={icon} className={styles.bullet}>
            <Icon name={icon} className={styles.bulletIcon} />
            <span>{lang(key, undefined, { withNodes: true, withMarkdown: true })}</span>
          </div>
        ))}
      </div>
      <WalletNoticeActions>
        <Button pill isLoading={isLoading} disabled={isLoading} onClick={onShow}>
          {lang('WalletShowRecoveryPhrase')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletPhraseInfoScreen);
