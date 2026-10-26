import { memo, useMemo } from '../../../lib/teact/teact';

import type { TableAboutData } from '../common/TableAboutModal';

import useLang from '../../../hooks/useLang';

import SafeLink from '../../common/SafeLink';
import ParticlesHeader from '../common/ParticlesHeader';
import TableAboutModal from '../common/TableAboutModal';
import { WALLET_FEATURES, WALLET_TERMS_URL } from './WalletFeatures';

import styles from './WalletHowItWorksModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const WalletHowItWorksModal = ({ isOpen, onClose }: OwnProps) => {
  const lang = useLang();

  const listItemData = useMemo(() => WALLET_FEATURES.map(([icon, titleKey, textKey]) => (
    [icon, lang(titleKey), lang(textKey)]
  )) satisfies TableAboutData, [lang]);

  const header = useMemo(() => (
    <ParticlesHeader
      model="diamond-3d"
      color="blue"
      title={lang('WalletHowItWorksTitle')}
      description={lang('WalletHowItWorksSubtitle')}
      className={styles.header}
    />
  ), [lang]);

  const footer = useMemo(() => (
    <div className={styles.terms}>
      {lang('WalletTermsNotice', {
        link: <SafeLink url={WALLET_TERMS_URL} text={lang('WalletTermsLink')} />,
      }, { withNodes: true })}
    </div>
  ), [lang]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      listItemData={listItemData}
      header={header}
      footer={footer}
      buttonText={lang('WalletHowItWorksDone')}
      isNativeDialog
      onClose={onClose}
    />
  );
};

export default memo(WalletHowItWorksModal);
