import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { LeftColumnContent, SettingsScreens } from '../../types';
import type { FolderEditDispatch } from '../../hooks/reducers/useFoldersReducer';
import type { GlobalState } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';
import useShowTransition from '../../hooks/useShowTransition';
import useForumPanelRender from '../../hooks/useForumPanelRender';

import Button from '../ui/Button';
import ChatList from './main/ChatList';
import ForumPanel from './main/ForumPanel';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

import './ArchivedChats.scss';

export type OwnProps = {
  isActive: boolean;
  isForumPanelOpen?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  onReset: () => void;
  onTopicSearch: NoneToVoidFunction;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

const ArchivedChats: FC<OwnProps> = ({
  isActive,
  isForumPanelOpen,
  archiveSettings,
  onReset,
  onTopicSearch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
  foldersDispatch,
}) => {
  const { updateArchiveSettings } = getActions();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleDisplayArchiveInChats = useCallback(() => {
    updateArchiveSettings({ isHidden: false });
  }, [updateArchiveSettings]);

  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(isForumPanelOpen);

  const {
    shouldRender: shouldRenderTitle,
    transitionClassNames: titleClassNames,
  } = useShowTransition(!isForumPanelOpen);

  const { shouldRenderForumPanel, handleForumPanelAnimationEnd } = useForumPanelRender(isForumPanelOpen);

  return (
    <div className="ArchivedChats">
      <div className="left-header">
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={onReset}
          ariaLabel="Return to chat list"
          className={buildClassName(
            lang.isRtl && 'rtl',
            isForumPanelOpen && lang.isRtl && 'right-aligned',
            shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
          )}
          onTransitionEnd={handleDropdownMenuTransitionEnd}
        >
          <i className="icon-arrow-left" />
        </Button>
        {shouldRenderTitle && <h3 className={titleClassNames}>{lang('ArchivedChats')}</h3>}
        {archiveSettings.isHidden && (
          <DropdownMenu
            className="archived-chats-more-menu"
            positionX="right"
            onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
          >
            <MenuItem icon="archive-from-main" onClick={handleDisplayArchiveInChats}>
              {lang('lng_context_archive_to_list')}
            </MenuItem>
          </DropdownMenu>
        )}
      </div>
      <ChatList
        folderType="archived"
        isActive={isActive}
        isForumPanelOpen={isForumPanelOpen}
        onSettingsScreenSelect={onSettingsScreenSelect}
        onLeftColumnContentChange={onLeftColumnContentChange}
        foldersDispatch={foldersDispatch}
        archiveSettings={archiveSettings}
      />
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          onTopicSearch={onTopicSearch}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
    </div>
  );
};

export default memo(ArchivedChats);
