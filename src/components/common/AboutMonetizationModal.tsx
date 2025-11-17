import type { FC } from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';

import type { TableAboutData } from '../modals/common/TableAboutModal';

import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import TableAboutModal from '../modals/common/TableAboutModal';
import Icon from './icons/Icon';
import SafeLink from './SafeLink';

import styles from './AboutMonetizationModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const AboutMonetizationModal: FC<OwnProps> = ({
  isOpen,
  onClose,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();

  const blockchainText = useMemo(() => {
    const linkText = oldLang('LearnMore');
    return lang(
      'ChannelEarnLearnCoinAbout',
      {
        link: (
          <SafeLink url={oldLang('MonetizationInfoTONLink')} text={linkText}>
            {linkText}
            <Icon name="next" />
          </SafeLink>
        ),
      },
      {
        withNodes: true,
      },
    );
  }, [lang, oldLang]);

  const monetizationTitle = useMemo(() => {
    return lang(
      'MonetizationInfoTONTitle',
      undefined,
      {
        withNodes: true,
        specialReplacement: { '💎': <Icon className={styles.toncoin} name="toncoin" /> },
      },
    );
  }, [lang]);

  const modalData = useMemo(() => {
    if (!isOpen) return undefined;

    const header = (
      <h3 className={styles.title}>{oldLang('lng_channel_earn_learn_title')}</h3>
    );

    const listItemData = [
      ['channel', oldLang('lng_channel_earn_learn_in_subtitle'),
        renderText(oldLang('lng_channel_earn_learn_in_about'), ['simple_markdown'])],
      ['revenue-split', oldLang('lng_channel_earn_learn_split_subtitle'),
        renderText(oldLang('Monetization.Intro.Split.Text'), ['simple_markdown'])],
      ['cash-circle', oldLang('lng_channel_earn_learn_out_subtitle'),
        renderText(oldLang('lng_channel_earn_learn_out_about'), ['simple_markdown'])],
    ] satisfies TableAboutData;

    const footer = (
      <>
        <h3 className={styles.title}>{monetizationTitle}</h3>
        <p className={styles.description}>{blockchainText}</p>
      </>
    );

    return {
      header,
      listItemData,
      footer,
    };
  }, [isOpen, oldLang, monetizationTitle, blockchainText]);

  if (!modalData) {
    return undefined;
  }

  return (
    <TableAboutModal
      isOpen={isOpen}
      listItemData={modalData.listItemData}
      headerIconName="cash-circle"
      headerIconPremiumGradient
      withSeparator
      header={modalData.header}
      footer={modalData.footer}
      buttonText={oldLang('RevenueSharingAdsUnderstood')}
      onClose={onClose}
    />
  );
};

export default memo(AboutMonetizationModal);
