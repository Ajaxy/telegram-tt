import { memo, useMemo } from '../../lib/teact/teact';

import type { TableAboutData } from '../modals/common/TableAboutModal';

import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

import TableAboutModal from '../modals/common/TableAboutModal';
import GramIcon from './icons/GramIcon';
import Icon from './icons/Icon';
import SafeLink from './SafeLink';

import styles from './AboutMonetizationModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const AboutMonetizationModal = ({
  isOpen,
  onClose,
}: OwnProps) => {
  const lang = useLang();

  const blockchainText = useMemo(() => {
    const linkText = lang('LearnMore');
    return lang(
      'ChannelEarnLearnCoinAbout',
      {
        link: (
          <SafeLink url={lang('MonetizationInfoTONLink')} text={linkText}>
            {linkText}
            <Icon name="next" />
          </SafeLink>
        ),
      },
      {
        withNodes: true,
      },
    );
  }, [lang]);

  const monetizationTitle = useMemo(() => {
    return lang(
      'MonetizationInfoGramTitle',
      undefined,
      {
        withNodes: true,
        specialReplacement: { '💎': <GramIcon className={styles.toncoin} /> },
      },
    );
  }, [lang]);

  const modalData = useMemo(() => {
    if (!isOpen) return undefined;

    const header = (
      <h3 className={styles.title}>{lang('ChannelEarnLearnTitle')}</h3>
    );

    const listItemData = [
      ['channel', lang('ChannelEarnLearnInSubtitle'),
        renderText(lang('ChannelEarnLearnInAbout'), ['simple_markdown'])],
      ['revenue-split', lang('ChannelEarnLearnSplitSubtitle'),
        renderText(lang('MonetizationIntroSplitText'), ['simple_markdown'])],
      ['cash-circle', lang('ChannelEarnLearnOutSubtitle'),
        renderText(lang('ChannelEarnLearnOutAbout'), ['simple_markdown'])],
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
  }, [isOpen, lang, monetizationTitle, blockchainText]);

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
      buttonText={lang('ButtonUnderstood')}
      onClose={onClose}
    />
  );
};

export default memo(AboutMonetizationModal);
