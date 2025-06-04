import type { ElementRef, FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { IAnchorPosition } from '../../../types';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import SponsoredContextMenu from './SponsoredContextMenu';

export type OwnProps = {
  isOpen: boolean;
  randomId: string;
  sponsorInfo?: string;
  additionalInfo?: string;
  canReport?: boolean;
  anchor: IAnchorPosition;
  triggerRef: ElementRef<HTMLElement>;
  shouldSkipAbout?: boolean;
  onItemClick?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd: NoneToVoidFunction;
};

const SponsoredMessageContextMenuContainer: FC<OwnProps> = ({
  isOpen,
  randomId,
  sponsorInfo,
  additionalInfo,
  canReport,
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
    reportSponsored,
    hideSponsored,
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
    openAboutAdsModal({
      randomId,
      additionalInfo,
      canReport,
      sponsorInfo,
    });
    handleItemClick();
  });

  const handleSponsoredHide = useLastCallback(() => {
    hideSponsored();
    handleItemClick();
  });

  const handleSponsorInfo = useLastCallback(() => {
    showDialog({
      data: {
        message: [sponsorInfo, additionalInfo].filter(Boolean).join('\n'),
      },
    });
    handleItemClick();
  });

  const handleReportSponsoredMessage = useLastCallback(() => {
    reportSponsored({ randomId });
    handleItemClick();
  });

  if (!anchor) {
    return undefined;
  }

  return (
    <div ref={ref} className="ContextMenuContainer">
      <SponsoredContextMenu
        isOpen={isOpen}
        anchor={anchor}
        triggerRef={triggerRef}
        canReport={canReport}
        sponsorInfo={sponsorInfo}
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
