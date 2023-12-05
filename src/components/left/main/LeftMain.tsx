/* eslint-disable no-null/no-null */
import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import { LeftColumnContent, SettingsScreens } from '../../../types';

import { PRODUCTION_URL } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { IS_ELECTRON, IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useCommands from '../../../hooks/useCommands';
import useForumPanelRender from '../../../hooks/useForumPanelRender';
import { useJune } from '../../../hooks/useJune';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import Button from '../../ui/Button';
import Transition from '../../ui/Transition';
import NewChatButton from '../NewChatButton';
import LeftSearch from '../search/LeftSearch.async';
import ChatFolders from './ChatFolders';
import ContactList from './ContactList.async';
import ForumPanel from './ForumPanel';
import LeftMainHeader from './LeftMainHeader';

import './LeftMain.scss';

type OwnProps = {
  content: LeftColumnContent;
  chatId?: string;
  userId?: string;
  searchQuery?: string;
  searchDate?: number;
  contactsFilter: string;
  shouldSkipTransition?: boolean;
  foldersDispatch: FolderEditDispatch;
  isAppUpdateAvailable?: boolean;
  isElectronUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  isClosingSearch?: boolean;
  chatFoldersPortalRef: RefObject<HTMLDivElement>;
  onSearchQuery: (query: string) => void;
  onContentChange: (content: LeftColumnContent) => void;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  onTopicSearch: NoneToVoidFunction;
  onReset: () => void;
};

const TRANSITION_RENDER_COUNT = Object.keys(LeftColumnContent).length / 2;
const BUTTON_CLOSE_DELAY_MS = 250;

let closeTimeout: number | undefined;

const LeftMain: FC<OwnProps> = ({
  content,
  chatId,
  userId,
  searchQuery,
  searchDate,
  isClosingSearch,
  contactsFilter,
  shouldSkipTransition,
  foldersDispatch,
  isAppUpdateAvailable,
  isElectronUpdateAvailable,
  isForumPanelOpen,
  chatFoldersPortalRef,
  onSearchQuery,
  onContentChange,
  onSettingsScreenSelect,
  onReset,
  onTopicSearch,
}) => {
  const { closeForumPanel } = getActions();
  const [isNewChatButtonShown, setIsNewChatButtonShown] = useState(IS_TOUCH_ENV);
  const [isElectronAutoUpdateEnabled, setIsElectronAutoUpdateEnabled] = useState(false);
  const { useCommand } = useCommands();
  const { track } = useJune();
  useEffect(() => {
    window.electron?.getIsAutoUpdateEnabled().then(setIsElectronAutoUpdateEnabled);
  }, []);

  const {
    shouldRenderForumPanel, handleForumPanelAnimationEnd,
    handleForumPanelAnimationStart, isAnimationStarted,
  } = useForumPanelRender(isForumPanelOpen);
  const isForumPanelRendered = isForumPanelOpen && content === LeftColumnContent.ChatList;
  const isForumPanelVisible = isForumPanelRendered && isAnimationStarted;

  const {
    shouldRender: shouldRenderUpdateButton,
    transitionClassNames: updateButtonClassNames,
  } = useShowTransition(isAppUpdateAvailable || isElectronUpdateAvailable);

  const isMouseInside = useRef(false);

  const handleMouseEnter = useLastCallback(() => {
    if (content !== LeftColumnContent.ChatList) {
      return;
    }
    isMouseInside.current = true;
    setIsNewChatButtonShown(true);
  });

  const handleMouseLeave = useLastCallback(() => {
    isMouseInside.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInside.current) {
        setIsNewChatButtonShown(false);
      }
    }, BUTTON_CLOSE_DELAY_MS);
  });

  const handleSelectSettings = useLastCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  });

  const handleSelectContacts = useLastCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  });

  const handleSelectArchived = useLastCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  });

  const handleUpdateClick = useLastCallback(() => {
    if (IS_ELECTRON && !isElectronAutoUpdateEnabled) {
      window.open(`${PRODUCTION_URL}/get`, '_blank', 'noopener');
    } else if (isElectronUpdateAvailable) {
      window.electron?.installUpdate();
    } else {
      window.location.reload();
    }
    track?.('Click on Update app button');
  });

  const handleSelectNewChannel = useLastCallback(() => {
    onContentChange(LeftColumnContent.NewChannelStep1);
  });

  const handleSelectNewGroup = useLastCallback(() => {
    onContentChange(LeftColumnContent.NewGroupStep1);
  });

  const handleCreateFolder = useLastCallback(() => {
    foldersDispatch({ type: 'reset' });
    onSettingsScreenSelect(SettingsScreens.FoldersCreateFolder);
  });

  useCommand('NEW_CHANNEL', handleSelectNewChannel);
  useCommand('NEW_GROUP', handleSelectNewGroup);
  useCommand('NEW_FOLDER', handleCreateFolder);
  useCommand('NEW_FOLDER', handleCreateFolder);
  useCommand('OPEN_SETTINGS', handleSelectSettings);
  useCommand('OPEN_ARCHIVED', handleSelectArchived);

  useEffect(() => {
    let autoCloseTimeout: number | undefined;
    if (content !== LeftColumnContent.ChatList) {
      autoCloseTimeout = window.setTimeout(() => {
        setIsNewChatButtonShown(false);
      }, BUTTON_CLOSE_DELAY_MS);
    } else if (isMouseInside.current || IS_TOUCH_ENV) {
      setIsNewChatButtonShown(true);
    }

    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = undefined;
      }
    };
  }, [content]);

  const lang = useLang();

  const leftMainHeaderRef = useRef<HTMLDivElement>(null);

  return (
    <div
      id="LeftColumn-main"
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      <LeftMainHeader
        leftMainHeaderRef={leftMainHeaderRef}
        shouldHideSearch={isForumPanelVisible}
        content={content}
        contactsFilter={contactsFilter}
        onSearchQuery={onSearchQuery}
        onSelectSettings={handleSelectSettings}
        onSelectContacts={handleSelectContacts}
        onSelectArchived={handleSelectArchived}
        onReset={onReset}
        isClosingSearch={isClosingSearch}
      />
      <Transition
        name={shouldSkipTransition ? 'none' : 'zoomFade'}
        renderCount={TRANSITION_RENDER_COUNT}
        activeKey={content}
        shouldCleanup
        cleanupExceptionKey={LeftColumnContent.ChatList}
        shouldWrap
        wrapExceptionKey={LeftColumnContent.ChatList}
      >
        {(isActive) => {
          switch (content) {
            case LeftColumnContent.ChatList:
              return (
                <ChatFolders
                  leftMainHeaderRef={leftMainHeaderRef}
                  content={content}
                  chatFoldersPortalRef={chatFoldersPortalRef}
                  chatId={chatId}
                  userId={userId}
                  shouldHideFolderTabs={isForumPanelVisible}
                  onSettingsScreenSelect={onSettingsScreenSelect}
                  onLeftColumnContentChange={onContentChange}
                  foldersDispatch={foldersDispatch}
                  isForumPanelOpen={isForumPanelVisible}
                  onScreenSelect={onSettingsScreenSelect}
                  dispatch={foldersDispatch}
                />
              );
            case LeftColumnContent.GlobalSearch:
              return (
                <LeftSearch
                  searchQuery={searchQuery}
                  searchDate={searchDate}
                  isActive={isActive}
                  onReset={onReset}
                />
              );
            case LeftColumnContent.Contacts:
              return <ContactList filter={contactsFilter} isActive={isActive} onReset={onReset} />;
            default:
              return undefined;
          }
        }}
      </Transition>
      {shouldRenderUpdateButton && (
        <Button
          fluid
          pill
          className={buildClassName('btn-update', updateButtonClassNames)}
          onClick={handleUpdateClick}
        >
          {lang('lng_update_ulu')}
        </Button>
      )}
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          isHidden={!isForumPanelRendered}
          onTopicSearch={onTopicSearch}
          onOpenAnimationStart={handleForumPanelAnimationStart}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
      <NewChatButton
        isShown={isNewChatButtonShown}
        onNewPrivateChat={handleSelectContacts}
        onNewChannel={handleSelectNewChannel}
        onNewGroup={handleSelectNewGroup}
      />
    </div>
  );
};

export default memo(LeftMain);
