import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { TableAboutData } from '../common/TableAboutModal';

import { selectSponsoredMessage } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import SafeLink from '../../common/SafeLink';
import SponsoredMessageContextMenuContainer from '../../middle/message/SponsoredMessageContextMenuContainer';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TableAboutModal from '../common/TableAboutModal';

import styles from './AboutAdsModal.module.scss';

export type OwnProps = {
  // eslint-disable-next-line react/no-unused-prop-types
  modal: TabState['aboutAdsModal'];
};

type StateProps = {
  message?: ApiSponsoredMessage;
  minLevelToRestrictAds?: number;
};

const AboutAdsModal = ({ message, minLevelToRestrictAds }: OwnProps & StateProps) => {
  const { closeAboutAdsModal } = getActions();

  // eslint-disable-next-line no-null/no-null
  const moreMenuRef = useRef<HTMLButtonElement>(null);

  const isOpen = Boolean(message);
  const isMonetizationSharing = message?.canReport;

  const renderingIsNewDesign = useCurrentOrPrev(isMonetizationSharing);

  const oldLang = useOldLang();

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
        <h3 className={styles.title}>{oldLang('AboutRevenueSharingAds')}</h3>
        <p className={buildClassName(styles.description, styles.secondary)}>
          {oldLang('RevenueSharingAdsAlertSubtitle')}
        </p>
        <Button
          ref={moreMenuRef}
          round
          size="smaller"
          color="translucent"
          className={styles.moreButton}
          onClick={handleContextMenu}
        >
          <Icon name="more" />
        </Button>
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
  }, [isOpen, oldLang, handleContextMenu, minLevelToRestrictAds]);

  if (renderingIsNewDesign) {
    return (
      <>
        <TableAboutModal
          isOpen={isOpen}
          listItemData={modalData?.listItemData}
          headerIconName="channel"
          withSeparator
          header={modalData?.header}
          footer={modalData?.footer}
          buttonText={oldLang('RevenueSharingAdsUnderstood')}
          onClose={handleClose}
        />
        {contextMenuAnchor && message && (
          <SponsoredMessageContextMenuContainer
            isOpen={isContextMenuOpen}
            anchor={contextMenuAnchor}
            triggerRef={moreMenuRef}
            message={message}
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
        size="smaller"
        onClick={handleClose}
      >
        {oldLang('RevenueSharingAdsUnderstood')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const message = modal?.chatId ? selectSponsoredMessage(global, modal.chatId) : undefined;
    const minLevelToRestrictAds = global.appConfig?.channelRestrictAdsLevelMin;

    return {
      message,
      minLevelToRestrictAds,
    };
  },
)(AboutAdsModal));
