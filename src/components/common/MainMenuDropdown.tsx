import { type FC, memo } from '@teact';
import { getActions } from '../../global';

import { LeftColumnContent, SettingsScreens } from '../../types';

import {
  APP_NAME,
  DEBUG,
  IS_BETA,
} from '../../config';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLeftHeaderButtonRtlForumTransition from '../left/main/hooks/useLeftHeaderButtonRtlForumTransition';

import LeftSideMenuItems from '../left/main/LeftSideMenuItems';
import DropdownMenu from '../ui/DropdownMenu';

type OwnProps = {
  trigger?: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  shouldHideSearch?: boolean;
  className?: string;
};

const LeftSideMenuDropdown = ({
  trigger,
  shouldHideSearch,
  className,
}: OwnProps) => {
  const { openLeftColumnContent, closeForumPanel, openSettingsScreen } = getActions();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const lang = useLang();

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const handleSelectSettings = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.Main });
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
        lang.isRtl && 'rtl',
        shouldHideSearch && lang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
        className,
      )}
      forceOpen={isBotMenuOpen}
      positionX={shouldHideSearch && lang.isRtl ? 'right' : 'left'}
      transformOriginX={90}
      transformOriginY={100}
      onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
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

export default memo(LeftSideMenuDropdown);
