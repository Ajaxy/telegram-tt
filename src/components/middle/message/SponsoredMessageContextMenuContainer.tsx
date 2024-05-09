import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import MessageContextMenu from './MessageContextMenu';

export type OwnProps = {
  isOpen: boolean;
  message: ApiSponsoredMessage;
  anchor: IAnchorPosition;
  onAboutAds: NoneToVoidFunction;
  onReportAd: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd: NoneToVoidFunction;
};

const SponsoredMessageContextMenuContainer: FC<OwnProps> = ({
  message,
  anchor,
  onAboutAds,
  onReportAd,
  onClose,
  onCloseAnimationEnd,
}) => {
  const { openPremiumModal, showDialog } = getActions();

  const [isMenuOpen, , closeMenu] = useFlag(true);
  const { transitionClassNames } = useShowTransition(isMenuOpen, onCloseAnimationEnd, undefined, false);

  const handleAboutAdsOpen = useLastCallback(() => {
    onAboutAds();
    closeMenu();
  });

  const handleSponsoredHide = useLastCallback(() => {
    closeMenu();
    openPremiumModal();
    onClose();
  });

  const handleSponsorInfo = useLastCallback(() => {
    closeMenu();
    showDialog({
      data: {
        message: [message.sponsorInfo, message.additionalInfo].join('\n'),
      },
    });
  });

  const handleReportSponsoredMessage = useLastCallback(() => {
    closeMenu();
    onReportAd();
  });

  if (!anchor) {
    return undefined;
  }

  return (
    <div className={buildClassName('ContextMenuContainer', transitionClassNames)}>
      <MessageContextMenu
        isOpen={isMenuOpen}
        anchor={anchor}
        message={message}
        onClose={closeMenu}
        onCloseAnimationEnd={closeMenu}
        onAboutAds={handleAboutAdsOpen}
        onSponsoredHide={handleSponsoredHide}
        onSponsorInfo={handleSponsorInfo}
        onSponsoredReport={handleReportSponsoredMessage}
      />
    </div>
  );
};

export default memo(SponsoredMessageContextMenuContainer);
