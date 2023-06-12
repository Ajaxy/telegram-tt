import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { selectIsCurrentUserPremium, selectIsPremiumPurchaseBlocked } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';

import MessageContextMenu from './MessageContextMenu';

export type OwnProps = {
  isOpen: boolean;
  message: ApiSponsoredMessage;
  anchor: IAnchorPosition;
  onAboutAds: () => void;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  canBuyPremium?: boolean;
};

const SponsoredMessageContextMenuContainer: FC<OwnProps & StateProps> = ({
  message,
  anchor,
  onAboutAds,
  onClose,
  onCloseAnimationEnd,
  canBuyPremium,
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
        onSponsoredHide={canBuyPremium ? handleSponsoredHide : undefined}
        onSponsorInfo={handleSponsorInfo}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      canBuyPremium: !selectIsCurrentUserPremium(global) && !selectIsPremiumPurchaseBlocked(global),
    };
  },
)(SponsoredMessageContextMenuContainer));
