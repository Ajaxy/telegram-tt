import React, {
  FC, memo, useState, useRef, useCallback, useEffect,
} from '../../../lib/teact/teact';

import { LeftColumnContent } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/environment';

import Transition from '../../ui/Transition';
import LeftMainHeader from './LeftMainHeader';
import ConnectionState from '../ConnectionState';
import ChatFolders from './ChatFolders';
import LeftSearch from '../search/LeftSearch.async';
import ContactList from './ContactList.async';
import NewChatButton from '../NewChatButton';

import './LeftMain.scss';

type OwnProps = {
  content: LeftColumnContent;
  searchQuery?: string;
  searchDate?: number;
  contactsFilter: string;
  onSearchQuery: (query: string) => void;
  onContentChange: (content: LeftColumnContent) => void;
  onReset: () => void;
};

type StateProps = {};

const TRANSITION_RENDER_COUNT = Object.keys(LeftColumnContent).length / 2;
const BUTTON_CLOSE_DELAY_MS = 250;
let closeTimeout: number | undefined;

const LeftMain: FC<OwnProps & StateProps> = ({
  content,
  searchQuery,
  searchDate,
  contactsFilter,
  onSearchQuery,
  onContentChange,
  onReset,
}) => {
  const [isNewChatButtonShown, setIsNewChatButtonShown] = useState(IS_TOUCH_ENV);

  const isMouseInside = useRef(false);

  const handleSelectSettings = useCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  }, [onContentChange]);

  const handleSelectContacts = useCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  }, [onContentChange]);

  const handleSelectNewChannel = useCallback(() => {
    onContentChange(LeftColumnContent.NewChannelStep1);
  }, [onContentChange]);

  const handleSelectNewGroup = useCallback(() => {
    onContentChange(LeftColumnContent.NewGroupStep1);
  }, [onContentChange]);

  const handleSelectArchived = useCallback(() => {
    onContentChange(LeftColumnContent.Archived);
  }, [onContentChange]);

  const handleMouseEnter = useCallback(() => {
    if (content !== LeftColumnContent.ChatList) {
      return;
    }
    isMouseInside.current = true;
    setIsNewChatButtonShown(true);
  }, [content]);

  const handleMouseLeave = useCallback(() => {
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
  }, []);

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

  return (
    <div
      id="LeftColumn-main"
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      <LeftMainHeader
        content={content}
        contactsFilter={contactsFilter}
        onSearchQuery={onSearchQuery}
        onSelectSettings={handleSelectSettings}
        onSelectContacts={handleSelectContacts}
        onSelectArchived={handleSelectArchived}
        onReset={onReset}
      />
      <ConnectionState />
      <Transition name="zoom-fade" renderCount={TRANSITION_RENDER_COUNT} activeKey={content}>
        {(isActive) => {
          switch (content) {
            case LeftColumnContent.ChatList:
              return <ChatFolders />;
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
              return <ContactList filter={contactsFilter} />;
            default:
              return undefined;
          }
        }}
      </Transition>
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
