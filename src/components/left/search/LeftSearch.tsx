import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { GlobalSearchContent } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { parseDateString } from '../../../util/date/dateFormat';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import AudioResults from './AudioResults';
import ChatMessageResults from './ChatMessageResults';
import ChatResults from './ChatResults';
import FileResults from './FileResults';
import LinkResults from './LinkResults';
import MediaResults from './MediaResults';

import './LeftSearch.scss';

export type OwnProps = {
  searchQuery?: string;
  searchDate?: number;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  currentContent?: GlobalSearchContent;
  chatId?: string;
};

const TABS = [
  { type: GlobalSearchContent.ChatList, title: 'SearchAllChatsShort' },
  { type: GlobalSearchContent.ChannelList, title: 'ChannelsTab' },
  { type: GlobalSearchContent.Media, title: 'SharedMediaTab2' },
  { type: GlobalSearchContent.Links, title: 'SharedLinksTab2' },
  { type: GlobalSearchContent.Files, title: 'SharedFilesTab2' },
  { type: GlobalSearchContent.Music, title: 'SharedMusicTab2' },
  { type: GlobalSearchContent.Voice, title: 'SharedVoiceTab2' },
];

const CHAT_TABS = [
  { type: GlobalSearchContent.ChatList, title: 'All Messages' },
  ...TABS.slice(2), // Skip ChatList and ChannelList, replaced with All Messages
];

const LeftSearch: FC<OwnProps & StateProps> = ({
  searchQuery,
  searchDate,
  isActive,
  currentContent = GlobalSearchContent.ChatList,
  chatId,
  onReset,
}) => {
  const {
    setGlobalSearchContent,
    setGlobalSearchDate,
  } = getActions();

  const lang = useLang();
  const [activeTab, setActiveTab] = useState(currentContent);
  const dateSearchQuery = useMemo(() => parseDateString(searchQuery), [searchQuery]);

  const tabs = chatId ? CHAT_TABS : TABS;

  const handleSwitchTab = useLastCallback((index: number) => {
    const tab = tabs[index];
    setGlobalSearchContent({ content: tab.type });
    setActiveTab(index);
  });

  const handleSearchDateSelect = useLastCallback((value: Date) => {
    setGlobalSearchDate({ date: value.getTime() / 1000 });
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useKeyboardListNavigation(containerRef, isActive, undefined, '.ListItem-button', true);

  return (
    <div className="LeftSearch" ref={containerRef} onKeyDown={handleKeyDown}>
      <TabList activeTab={activeTab} tabs={tabs} onSwitchTab={handleSwitchTab} />
      <Transition
        name={lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
        renderCount={tabs.length}
        activeKey={currentContent}
      >
        {(() => {
          switch (currentContent) {
            case GlobalSearchContent.ChatList:
            case GlobalSearchContent.ChannelList:
              if (chatId) {
                return (
                  <ChatMessageResults
                    searchQuery={searchQuery}
                    dateSearchQuery={dateSearchQuery}
                    onReset={onReset}
                    onSearchDateSelect={handleSearchDateSelect}
                  />
                );
              }
              return (
                <ChatResults
                  isChannelList={currentContent === GlobalSearchContent.ChannelList}
                  searchQuery={searchQuery}
                  searchDate={searchDate}
                  dateSearchQuery={dateSearchQuery}
                  onReset={onReset}
                  onSearchDateSelect={handleSearchDateSelect}
                />
              );
            case GlobalSearchContent.Media:
              return <MediaResults searchQuery={searchQuery} />;
            case GlobalSearchContent.Links:
              return <LinkResults searchQuery={searchQuery} />;
            case GlobalSearchContent.Files:
              return <FileResults searchQuery={searchQuery} />;
            case GlobalSearchContent.Music:
              return (
                <AudioResults
                  key="audio"
                  searchQuery={searchQuery}
                />
              );
            case GlobalSearchContent.Voice:
              return (
                <AudioResults
                  key="voice"
                  isVoice
                  searchQuery={searchQuery}
                />
              );
            default:
              return undefined;
          }
        })()}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentContent, chatId } = selectTabState(global).globalSearch;

    return { currentContent, chatId };
  },
)(LeftSearch));
