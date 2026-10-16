import { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import type { TableAboutData } from '../common/TableAboutModal';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import SafeLink from '../../common/SafeLink';
import SponsoredMessageContextMenuContainer from '../../middle/message/SponsoredContextMenuContainer';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TableAboutModal from '../common/TableAboutModal';

import styles from './AboutAdsModal.module.scss';

export type OwnProps = {

  modal: TabState['aboutAdsModal'];
};

type StateProps = {
  minLevelToRestrictAds?: number;
};

const AboutAdsModal = ({ modal, minLevelToRestrictAds }: OwnProps & StateProps) => {
  const { closeAboutAdsModal } = getActions();

  const moreMenuRef = useRef<HTMLButtonElement>();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const {
    canReport, randomId, additionalInfo, sponsorInfo,
  } = renderingModal || {};
  const isMonetizationSharing = canReport;

  const renderingIsNewDesign = useCurrentOrPrev(isMonetizationSharing);

  const lang = useLang();

  const regularAdContent = useMemo(() => {
    return (
      <>
        <h3>{lang('SponsoredMessageInfo')}</h3>
        <p>{renderText(lang('SponsoredMessageInfoDescription1'), ['br'])}</p>
        <p>{renderText(lang('SponsoredMessageInfoDescription2'), ['br'])}</p>
        <p>{renderText(lang('SponsoredMessageInfoDescription3'), ['br'])}</p>
        <p>
          <SafeLink
            url={lang('PromoteUrl')}
            text={lang('PromoteUrl')}
          />
        </p>
        <p>{renderText(lang('SponsoredMessageInfoDescription4'), ['br'])}</p>
      </>
    );
  }, [lang]);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleContextMenu, handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(moreMenuRef, !renderingIsNewDesign);

  const handleClose = useLastCallback(() => {
    closeAboutAdsModal();
    handleContextMenuClose();
    handleContextMenuHide();
  });

  const modalData = useMemo(() => {
    if (!isOpen) return undefined;

    const header = (
      <>
        <h3 className={styles.title}>{lang('AboutRevenueSharingAds')}</h3>
        <p className={buildClassName(styles.description, styles.secondary)}>
          {lang('RevenueSharingAdsAlertSubtitle')}
        </p>
        <Button
          ref={moreMenuRef}
          round
          size="smaller"
          color="translucent"
          className={styles.moreButton}
          onClick={handleContextMenu}
          iconName="more"
        />
      </>
    );

    const listItemData = [
      ['lock', lang('RevenueSharingAdsInfo1Title'),
        renderText(lang('RevenueSharingAdsInfo1Subtitle'), ['simple_markdown'])],
      ['revenue-split', lang('RevenueSharingAdsInfo2Title'),
        renderText(lang('RevenueSharingAdsInfo2Subtitle'), ['simple_markdown'])],
      ['nochannel', lang('RevenueSharingAdsInfo3Title'),
        renderText(lang('RevenueSharingAdsInfo3Subtitle', { level: minLevelToRestrictAds }), ['simple_markdown'])],
    ] satisfies TableAboutData;

    const footer = (
      <>
        <h3 className={styles.title}>{renderText(lang('RevenueSharingAdsInfo4Title'), ['simple_markdown'])}</h3>
        <p className={styles.description}>
          {renderText(lang('RevenueSharingAdsInfo4Subtitle2', { details: '' }), ['simple_markdown'])}
          <SafeLink
            url={lang('PromoteUrl')}
            text={lang('LearnMoreArrow')}
          />
        </p>
      </>
    );

    return {
      header,
      listItemData,
      footer,
    };
  }, [isOpen, lang, handleContextMenu, minLevelToRestrictAds]);

  if (renderingIsNewDesign) {
    return (
      <>
        <TableAboutModal
          isOpen={isOpen}
          listItemData={modalData?.listItemData}
          headerIconName="channel"
          headerIconPremiumGradient
          withSeparator
          header={modalData?.header}
          footer={modalData?.footer}
          buttonText={lang('Understood')}
          onClose={handleClose}
        />
        {contextMenuAnchor && randomId && (
          <SponsoredMessageContextMenuContainer
            isOpen={isContextMenuOpen}
            anchor={contextMenuAnchor}
            triggerRef={moreMenuRef}
            randomId={randomId}
            additionalInfo={additionalInfo}
            canReport={canReport}
            sponsorInfo={sponsorInfo}
            shouldSkipAbout
            onItemClick={handleClose}
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
          />
        )}
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      className={styles.root}
      contentClassName={styles.content}
      onClose={handleClose}
    >
      {regularAdContent}
      <Button
        onClick={handleClose}
      >
        {lang('Understood')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const minLevelToRestrictAds = global.appConfig.channelRestrictAdsLevelMin;

    return {
      minLevelToRestrictAds,
    };
  },
)(AboutAdsModal));
