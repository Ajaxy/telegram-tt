import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import SponsoredMessageContextMenu from './SponsoredMessageContextMenu';

export type OwnProps = {
  isOpen: boolean;
  message: ApiSponsoredMessage;
  anchor: IAnchorPosition;
  triggerRef: React.RefObject<HTMLElement>;
  shouldSkipAbout?: boolean;
  onItemClick?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd: NoneToVoidFunction;
};

const SponsoredMessageContextMenuContainer: FC<OwnProps> = ({
  isOpen,
  message,
  anchor,
  triggerRef,
  shouldSkipAbout,
  onItemClick,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    openAboutAdsModal,
    showDialog,
    reportSponsoredMessage,
    hideSponsoredMessages,
  } = getActions();

  const { ref } = useShowTransition({
    isOpen,
    onCloseAnimationEnd,
  });

  const handleItemClick = useLastCallback(() => {
    onItemClick?.();
    onClose();
  });

  const handleAboutAdsOpen = useLastCallback(() => {
    openAboutAdsModal({ chatId: message.chatId });
    handleItemClick();
  });

  const handleSponsoredHide = useLastCallback(() => {
    hideSponsoredMessages();
    handleItemClick();
  });

  const handleSponsorInfo = useLastCallback(() => {
    showDialog({
      data: {
        message: [message.sponsorInfo, message.additionalInfo].join('\n'),
      },
    });
    handleItemClick();
  });

  const handleReportSponsoredMessage = useLastCallback(() => {
    reportSponsoredMessage({ peerId: message.chatId, randomId: message.randomId });
    handleItemClick();
  });

  if (!anchor) {
    return undefined;
  }

  return (
    <div ref={ref} className="ContextMenuContainer">
      <SponsoredMessageContextMenu
        isOpen={isOpen}
        anchor={anchor}
        triggerRef={triggerRef}
        message={message}
        shouldSkipAbout={shouldSkipAbout}
        onClose={onClose}
        onCloseAnimationEnd={onClose}
        onAboutAdsClick={handleAboutAdsOpen}
        onSponsoredHide={handleSponsoredHide}
        onSponsorInfo={handleSponsorInfo}
        onSponsoredReport={handleReportSponsoredMessage}
      />
    </div>
  );
};

export default memo(SponsoredMessageContextMenuContainer);
