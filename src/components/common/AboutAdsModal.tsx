import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { TableAboutData } from '../modals/common/TableAboutModal';

import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useSelectorSignal from '../../hooks/data/useSelectorSignal';
import useDerivedState from '../../hooks/useDerivedState';
import useOldLang from '../../hooks/useOldLang';

import TableAboutModal from '../modals/common/TableAboutModal';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import SafeLink from './SafeLink';

import styles from './AboutAdsModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  isMonetizationSharing?: boolean;
  onClose: NoneToVoidFunction;
};

const AboutAdsModal: FC<OwnProps> = ({
  isOpen,
  isMonetizationSharing,
  onClose,
}) => {
  const oldLang = useOldLang();

  const minLevelSignal = useSelectorSignal((global) => global.appConfig?.channelRestrictAdsLevelMin);
  const minLevelToRestrictAds = useDerivedState(minLevelSignal);

  const regularAdContent = useMemo(() => {
    return (
      <>
        <h3>{oldLang('SponsoredMessageInfoScreen.Title')}</h3>
        <p>{renderText(oldLang('SponsoredMessageInfoDescription1'), ['br'])}</p>
        <p>{renderText(oldLang('SponsoredMessageInfoDescription2'), ['br'])}</p>
        <p>{renderText(oldLang('SponsoredMessageInfoDescription3'), ['br'])}</p>
        <p>
          <SafeLink
            url={oldLang('SponsoredMessageAlertLearnMoreUrl')}
            text={oldLang('SponsoredMessageAlertLearnMoreUrl')}
          />
        </p>
        <p>{renderText(oldLang('SponsoredMessageInfoDescription4'), ['br'])}</p>
      </>
    );
  }, [oldLang]);

  const modalData = useMemo(() => {
    if (!isOpen) return undefined;

    const header = (
      <>
        <h3 className={styles.title}>{oldLang('AboutRevenueSharingAds')}</h3>
        <p className={buildClassName(styles.description, styles.secondary)}>
          {oldLang('RevenueSharingAdsAlertSubtitle')}
        </p>
      </>
    );

    const listItemData = [
      ['lock', oldLang('RevenueSharingAdsInfo1Title'),
        renderText(oldLang('RevenueSharingAdsInfo1Subtitle'), ['simple_markdown'])],
      ['revenue-split', oldLang('RevenueSharingAdsInfo2Title'),
        renderText(oldLang('RevenueSharingAdsInfo2Subtitle'), ['simple_markdown'])],
      ['nochannel', oldLang('RevenueSharingAdsInfo3Title'),
        renderText(oldLang('RevenueSharingAdsInfo3Subtitle', minLevelToRestrictAds), ['simple_markdown'])],
    ] satisfies TableAboutData;

    const footer = (
      <>
        <h3 className={styles.title}>{renderText(oldLang('RevenueSharingAdsInfo4Title'), ['simple_markdown'])}</h3>
        <p className={styles.description}>
          {renderText(oldLang('RevenueSharingAdsInfo4Subtitle2', ''), ['simple_markdown'])}
          <SafeLink
            url={oldLang('PromoteUrl')}
            text={oldLang('LearnMoreArrow')}
          />
        </p>
      </>
    );

    return {
      header,
      listItemData,
      footer,
    };
  }, [isOpen, oldLang, minLevelToRestrictAds]);

  if (isMonetizationSharing && modalData) {
    return (
      <TableAboutModal
        isOpen={isOpen}
        listItemData={modalData.listItemData}
        headerIconName="channel"
        header={modalData.header}
        footer={modalData.footer}
        buttonText={oldLang('RevenueSharingAdsUnderstood')}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      className={styles.root}
      contentClassName={styles.content}
      onClose={onClose}
    >
      {regularAdContent}
      <Button
        size="smaller"
        onClick={onClose}
      >
        {oldLang('RevenueSharingAdsUnderstood')}
      </Button>
    </Modal>
  );
};

export default memo(AboutAdsModal);
