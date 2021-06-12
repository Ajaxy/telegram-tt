import React, {
  FC, memo, useCallback, useState, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { GlobalSearchContent } from '../../../types';

import { pick } from '../../../util/iteratees';
import { parseDateString } from '../../../util/dateFormat';
import useLang from '../../../hooks/useLang';

import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import ChatResults from './ChatResults';
import UserChatResults from './ChatMessageResults';
import MediaResults from './MediaResults';
import LinkResults from './LinkResults';
import FileResults from './FileResults';
import AudioResults from './AudioResults';

import './LeftSearch.scss';

export type OwnProps = {
  searchQuery?: string;
  searchDate?: number;
  onReset: () => void;
};

type StateProps = {
  currentContent?: GlobalSearchContent;
  chatId?: number;
};

type DispatchProps = Pick<GlobalActions, ('setGlobalSearchContent' | 'setGlobalSearchDate')>;

const TABS = [
  { type: GlobalSearchContent.ChatList, title: 'SearchAllChatsShort' },
  { type: GlobalSearchContent.Media, title: 'SharedMediaTab2' },
  { type: GlobalSearchContent.Links, title: 'SharedLinksTab2' },
  { type: GlobalSearchContent.Files, title: 'SharedFilesTab2' },
  { type: GlobalSearchContent.Music, title: 'SharedMusicTab2' },
  { type: GlobalSearchContent.Voice, title: 'SharedVoiceTab2' },
];

const CHAT_TABS = [
  { type: GlobalSearchContent.ChatList, title: 'All Messages' },
  ...TABS.slice(1),
];

const TRANSITION_RENDER_COUNT = Object.keys(GlobalSearchContent).length / 2;

const LeftSearch: FC<OwnProps & StateProps & DispatchProps> = ({
  searchQuery,
  searchDate,
  currentContent = GlobalSearchContent.ChatList,
  chatId,
  setGlobalSearchContent,
  setGlobalSearchDate,
  onReset,
}) => {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState(0);
  const dateSearchQuery = useMemo(() => parseDateString(searchQuery), [searchQuery]);

  const handleSwitchTab = useCallback((index: number) => {
    const tab = TABS[index];
    setGlobalSearchContent({ content: tab.type });
    setActiveTab(index);
  }, [setGlobalSearchContent]);

  const handleSearchDateSelect = useCallback((value: Date) => {
    setGlobalSearchDate({ date: value.getTime() / 1000 });
  }, [setGlobalSearchDate]);

  return (
    <div className="LeftSearch">
      <TabList activeTab={activeTab} tabs={chatId ? CHAT_TABS : TABS} onSwitchTab={handleSwitchTab} />
      <Transition
        name={lang.isRtl ? 'slide-reversed' : 'slide'}
        renderCount={TRANSITION_RENDER_COUNT}
        activeKey={currentContent}
      >
        {() => {
          switch (currentContent) {
            case GlobalSearchContent.ChatList:
              if (chatId) {
                return (
                  <UserChatResults
                    searchQuery={searchQuery}
                    dateSearchQuery={dateSearchQuery}
                    onReset={onReset}
                    onSearchDateSelect={handleSearchDateSelect}
                  />
                );
              }
              return (
                <ChatResults
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
        }}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentContent, chatId } = global.globalSearch;

    return { currentContent, chatId };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['setGlobalSearchContent', 'setGlobalSearchDate']),
)(LeftSearch));
