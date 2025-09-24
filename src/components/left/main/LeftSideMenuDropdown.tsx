import type { FC } from '../../../lib/teact/teact';
import {
  memo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { LeftColumnContent } from '../../../types';

import {
  APP_NAME,
  DEBUG,
  IS_BETA,
} from '../../../config';
import { IS_MAC_OS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';

import DropdownMenu from '../../ui/DropdownMenu';
import LeftSideMenuItems from './LeftSideMenuItems';

import './LeftMainHeader.scss';

type OwnProps = {
  trigger: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  shouldHideSearch?: boolean;
};

const LeftSideMenuDropdown: FC<OwnProps> = ({
  trigger,
  shouldHideSearch,
}) => {
  const { openLeftColumnContent, closeForumPanel } = getActions();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const oldLang = useOldLang();

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const handleSelectSettings = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Settings });
  });

  const handleSelectContacts = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Contacts });
  });

  const handleSelectArchived = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
    closeForumPanel();
  });

  return (
    <DropdownMenu
      trigger={trigger}
      footer={`${APP_NAME} ${versionString}`}
      className={buildClassName(
        'main-menu',
        oldLang.isRtl && 'rtl',
        shouldHideSearch && oldLang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
      )}
      forceOpen={isBotMenuOpen}
      positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
      transformOriginX={IS_MAC_OS && !isFullscreen ? 90 : undefined}
      onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
      />
    </DropdownMenu>
  );
};

export default memo(withGlobal<OwnProps>(
  () => {
    return {};
  },
)(LeftSideMenuDropdown));
