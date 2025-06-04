import type { ElementRef, FC } from '../../../lib/teact/teact';
import {
  memo, useRef,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

import './MessageContextMenu.scss';

type OwnProps = {
  isOpen: boolean;
  anchor: IAnchorPosition;
  sponsorInfo?: string;
  canReport?: boolean;
  triggerRef: ElementRef<HTMLElement>;
  shouldSkipAbout?: boolean;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  onAboutAdsClick: NoneToVoidFunction;
  onSponsoredHide: NoneToVoidFunction;
  onSponsorInfo?: NoneToVoidFunction;
  onSponsoredReport?: NoneToVoidFunction;
};

const SponsoredContextMenu: FC<OwnProps> = ({
  isOpen,
  sponsorInfo,
  canReport,
  anchor,
  triggerRef,
  shouldSkipAbout,
  onClose,
  onCloseAnimationEnd,
  onAboutAdsClick,
  onSponsoredHide,
  onSponsorInfo,
  onSponsoredReport,
}) => {
  const menuRef = useRef<HTMLDivElement>();
  const lang = useOldLang();

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getRootElement = useLastCallback(() => document.body);

  const isSeparatorNeeded = sponsorInfo || !shouldSkipAbout || canReport;

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      anchor={anchor}
      withPortal
      className="with-menu-transitions"
      getLayout={getLayout}
      getTriggerElement={getTriggerElement}
      getMenuElement={getMenuElement}
      getRootElement={getRootElement}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {sponsorInfo && onSponsorInfo && (
        <MenuItem icon="channel" onClick={onSponsorInfo}>{lang('SponsoredMessageSponsor')}</MenuItem>
      )}
      {!shouldSkipAbout && (
        <MenuItem icon="info" onClick={onAboutAdsClick}>
          {lang(canReport ? 'AboutRevenueSharingAds' : 'SponsoredMessageInfo')}
        </MenuItem>
      )}
      {canReport && onSponsoredReport && (
        <MenuItem icon="hand-stop" onClick={onSponsoredReport}>
          {lang('ReportAd')}
        </MenuItem>
      )}
      {isSeparatorNeeded && <MenuSeparator />}
      <MenuItem icon="close-circle" onClick={onSponsoredHide}>
        {lang('HideAd')}
      </MenuItem>
    </Menu>
  );
};

export default memo(SponsoredContextMenu);
