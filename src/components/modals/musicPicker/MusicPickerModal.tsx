import {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAudio, ApiChat, ApiUserSavedMusic,
} from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { MessageList, PlaybackItemRef, PlaybackSource } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  MAX_UPLOAD_FILEPART_SIZE,
  MUSIC_PICKER_GLOBAL_MIN_QUERY_LENGTH,
  MUSIC_PICKER_SEARCH_DEBOUNCE,
  SUPPORTED_AUDIO_CONTENT_TYPES,
} from '../../../config';
import { getChatNotifySettings } from '../../../global/helpers/notifications';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat,
  selectChatMessage,
  selectNotifyDefaults,
  selectNotifyException,
  selectPeerPaidMessagesStars,
  selectTabState,
  selectUserSavedMusic,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { revokeAttachmentUrls } from '../../../util/attachments';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { validateFiles } from '../../../util/files';
import { buildCollectionByCallback } from '../../../util/iteratees';
import { parseSearchResultKey } from '../../../util/keys/searchResultKey';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { debounce } from '../../../util/schedulers';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import buildAttachment from '../../middle/composer/helpers/buildAttachment';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import { useShallowSelector } from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSchedule from '../../../hooks/useSchedule';
import usePaidMessageConfirmation from '../../middle/composer/hooks/usePaidMessageConfirmation';

import PaymentMessageConfirmDialog from '../../common/PaymentMessageConfirmDialog';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import SearchInput from '../../ui/SearchInput';
import Transition from '../../ui/Transition';
import MusicPickerRow from './MusicPickerRow';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandTitle } from '@gili/layout/Island';
import Modal, {
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

import styles from './MusicPickerModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['musicPicker']>;
  isOpen: boolean;
};

type StateProps = {
  chat?: ApiChat;
  currentUserId?: string;
  savedMusic?: ApiUserSavedMusic;
  musicSearchAudiosById: Record<string, ApiAudio>;
  hasMusicSearchBot: boolean;
  isAppConfigLoaded?: boolean;
  paidMessagesStars?: number;
  paymentMessageConfirmDialogKey?: string;
  starsBalance: number;
  isStarsBalanceModalOpen: boolean;
  isSilentPosting?: boolean;
  fileSizeLimit: number;
};

type TrackRowData = {
  key: string;
  audio: ApiAudio;
  item: PlaybackItemRef;
};

type SearchDisplay = {
  key: string;
  rows: TrackRowData[];
};

type SendContent = {
  audio?: ApiAudio;
  file?: File;
};

type RichInputMedia = Pick<NonNullable<TabState['requestedRichInputMedia']>, 'audio' | 'files'>;

const PAYMENT_DIALOG_KEY = 'musicPicker';
const SCROLL_CONTAINER_SELECTOR = '.custom-scroll';
const SINGLE_SOURCE: PlaybackSource = { type: 'single' };
const AUDIO_FILES_ACCEPT = Array.from(SUPPORTED_AUDIO_CONTENT_TYPES).join(',');

const runDebouncedForSearch = debounce((cb) => cb(), MUSIC_PICKER_SEARCH_DEBOUNCE, false);

const MusicPickerModal = ({
  modal,
  isOpen,
  chat,
  currentUserId,
  savedMusic,
  musicSearchAudiosById,
  hasMusicSearchBot,
  isAppConfigLoaded,
  paidMessagesStars,
  paymentMessageConfirmDialogKey,
  starsBalance,
  isStarsBalanceModalOpen,
  isSilentPosting,
  fileSizeLimit,
}: OwnProps & StateProps) => {
  const {
    closeMusicPicker, loadSavedMusic, loadMusicPickerShared, loadMusicPickerGlobal, requestRichInputMedia, sendMessage,
    openLimitReachedModal, showNotification,
  } = getActions();

  const lang = useLang();
  const [query, setQuery] = useState('');
  const [listGeneration, setListGeneration] = useState(0);
  const [requestCalendar, calendar] = useSchedule();

  const {
    closeConfirmDialog,
    dialogHandler,
    shouldAutoApprove,
    setAutoApprove,
    handleWithConfirmation,
  } = usePaidMessageConfirmation(
    PAYMENT_DIALOG_KEY,
    paidMessagesStars || 0,
    isStarsBalanceModalOpen,
    starsBalance,
    true,
  );

  const { shared, global: globalResults } = modal;
  const isInScheduledList = modal.messageListType === 'scheduled';
  const trimmedQuery = query.trim();
  const isSearchMode = trimmedQuery.length >= MUSIC_PICKER_GLOBAL_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isOpen) return;

    setQuery('');
    loadMusicPickerShared();
  }, [isOpen, loadMusicPickerShared]);

  const retryGlobalSearch = useLastCallback(() => {
    if (!isOpen || !isSearchMode || globalResults?.query === trimmedQuery) return;

    loadMusicPickerGlobal({ query: trimmedQuery });
  });

  useEffect(() => {
    if (!hasMusicSearchBot) return;

    retryGlobalSearch();
  }, [hasMusicSearchBot, retryGlobalSearch]);

  useEffect(() => {
    if (!isOpen || !currentUserId || savedMusic) return;

    loadSavedMusic({ userId: currentUserId });
  }, [isOpen, currentUserId, savedMusic, loadSavedMusic]);

  const profileSource = useMemo<PlaybackSource | undefined>(() => (
    currentUserId ? { type: 'savedMusic', peerId: currentUserId } : undefined
  ), [currentUserId]);

  const profileRows = useMemo<TrackRowData[]>(() => {
    if (!savedMusic || !currentUserId) return MEMO_EMPTY_ARRAY;

    return savedMusic.ids.reduce<TrackRowData[]>((rows, audioId) => {
      const audio = savedMusic.byId[audioId];
      if (!audio) return rows;

      rows.push({
        key: audioId,
        audio,
        item: { type: 'savedMusic', peerId: currentUserId, audioId },
      });

      return rows;
    }, []);
  }, [savedMusic, currentUserId]);

  const sharedIds = shared?.ids;
  const sharedMessagesSelector = useCallback((global: GlobalState) => {
    if (!sharedIds) return undefined;

    return buildCollectionByCallback(sharedIds, (id) => {
      const [chatId, messageId] = parseSearchResultKey(id);
      return [id, selectChatMessage(global, chatId, messageId)];
    });
  }, [sharedIds]);
  const sharedMessagesById = useShallowSelector(sharedMessagesSelector);

  const sharedRows = useMemo<TrackRowData[]>(() => {
    if (!sharedIds || !sharedMessagesById) return MEMO_EMPTY_ARRAY;

    return sharedIds.reduce<TrackRowData[]>((rows, id) => {
      const message = sharedMessagesById[id];
      const audio = message?.content.audio;
      if (!message || !audio) return rows;

      rows.push({
        key: id,
        audio,
        item: {
          type: 'message', chatId: message.chatId, threadId: MAIN_THREAD_ID, messageId: message.id,
        },
      });

      return rows;
    }, []);
  }, [sharedIds, sharedMessagesById]);

  const globalIds = globalResults?.ids;
  const globalRows = useMemo<TrackRowData[]>(() => {
    if (!globalIds?.length) return MEMO_EMPTY_ARRAY;

    return globalIds.reduce<TrackRowData[]>((rows, audioId) => {
      const audio = musicSearchAudiosById[audioId];
      if (!audio) return rows;

      rows.push({ key: audioId, audio, item: { type: 'musicSearch', audioId } });

      return rows;
    }, []);
  }, [globalIds, musicSearchAudiosById]);

  const loadMoreItems = isSearchMode ? globalIds : sharedIds;

  const messageList = useMemo<MessageList>(() => ({
    chatId: modal.chatId,
    threadId: modal.threadId,
    type: isInScheduledList ? 'scheduled' : 'thread',
  }), [modal.chatId, modal.threadId, isInScheduledList]);

  const handleQueryChange = useLastCallback((value: string) => {
    setQuery(value);

    const nextQuery = value.trim();
    runDebouncedForSearch(() => {
      if (nextQuery.length >= MUSIC_PICKER_GLOBAL_MIN_QUERY_LENGTH) {
        loadMusicPickerGlobal({ query: nextQuery });
      }
    });
  });

  const handleLoadMore = useLastCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction !== LoadMoreDirection.Backwards) return;

    if (isSearchMode) {
      if (globalResults?.query === trimmedQuery && !globalResults.isFullyLoaded) {
        loadMusicPickerGlobal({ query: trimmedQuery });
      }
      return;
    }

    if (shared && !shared.isFullyLoaded) {
      loadMusicPickerShared();
    }
  });

  const handleTransitionStop = useLastCallback(() => {
    setListGeneration(listGeneration + 1);
  });

  const handleShowMore = useLastCallback(() => {
    if (!currentUserId) return;

    loadSavedMusic({ userId: currentUserId });
  });

  const showSkippedFileNotification = useLastCallback(() => {
    showNotification({ message: lang('RichMediaSkippedFiles', { count: 1 }, { pluralValue: 1 }) });
  });

  const submitContent = useLastCallback(async (
    { audio, file }: SendContent, scheduledAt?: number, scheduleRepeatPeriod?: number,
  ) => {
    closeMusicPicker();

    const attachment = file && await buildAttachment(file.name, file);
    if (attachment && !attachment.audio) {
      revokeAttachmentUrls(attachment);
      showSkippedFileNotification();
      return;
    }

    sendMessage({
      messageList,
      audio,
      attachments: attachment && [attachment],
      isSilent: scheduledAt ? undefined : isSilentPosting,
      scheduledAt,
      scheduleRepeatPeriod,
    });
  });

  const handleSubmit = useLastCallback((content: SendContent) => {
    if (isInScheduledList) {
      requestCalendar((scheduledAt, scheduleRepeatPeriod) => {
        handleWithConfirmation(submitContent, content, scheduledAt, scheduleRepeatPeriod);
      });
      return;
    }

    handleWithConfirmation(submitContent, content);
  });

  const insertToRichInput = useLastCallback((media: RichInputMedia) => {
    requestRichInputMedia({
      chatId: modal.chatId,
      threadId: modal.threadId,
      messageListType: modal.messageListType,
      ...media,
    });
    closeMusicPicker();
  });

  const handleSend = useLastCallback((audio: ApiAudio) => {
    if (modal.shouldInsertToRichInput) {
      insertToRichInput({ audio });
      return;
    }

    handleSubmit({ audio });
  });

  const handleSelectFromFiles = useLastCallback(() => {
    openSystemFilesDialog(AUDIO_FILES_ACCEPT, (e) => {
      const file = validateFiles((e.target as HTMLInputElement).files)?.[0];
      if (!file) return;

      if (!SUPPORTED_AUDIO_CONTENT_TYPES.has(file.type)) {
        showSkippedFileNotification();
        return;
      }

      if (modal.shouldInsertToRichInput) {
        insertToRichInput({ files: [file] });
        return;
      }

      if (file.size > fileSizeLimit) {
        openLimitReachedModal({ limit: 'uploadMaxFileparts' });
        return;
      }

      handleSubmit({ file });
    }, true);
  });

  const isProfileLoading = !savedMusic?.isLoaded && !profileRows.length;
  const isSharedLoading = Boolean(shared?.isLoading);
  const isGlobalLoading = Boolean(globalResults?.isLoading);
  const isDefaultReady = shared !== undefined && !(isSharedLoading && !sharedRows.length) && !isProfileLoading;
  const isGlobalReady = hasMusicSearchBot
    ? globalResults?.query === trimmedQuery && !(isGlobalLoading && !globalRows.length)
    : Boolean(isAppConfigLoaded);

  const searchDisplayRef = useRef<SearchDisplay>();
  if (isSearchMode && isGlobalReady) {
    searchDisplayRef.current = { key: trimmedQuery, rows: globalRows };
  }
  const searchDisplay = isSearchMode ? searchDisplayRef.current : undefined;
  const isShowingSearchResults = Boolean(searchDisplay);
  const isSearchLoading = isSearchMode && searchDisplay?.key !== trimmedQuery;
  const isSearching = isSearchMode ? isSearchLoading || isGlobalLoading : !isDefaultReady || isSharedLoading;

  const contentActiveKey = useTransitionActiveKey([isShowingSearchResults, searchDisplay?.key, isDefaultReady]);

  const listRef = useRef<HTMLDivElement>();
  useLayoutEffect(() => {
    const scrollContainer = listRef.current?.closest<HTMLDivElement>(SCROLL_CONTAINER_SELECTOR);
    if (!scrollContainer) return;

    scrollContainer.scrollTop = 0;
  }, [isShowingSearchResults, searchDisplay?.key]);

  const shouldShowProfileMore = savedMusic !== undefined && !savedMusic.isFullyLoaded && !isProfileLoading;

  const header = useMemo(() => (
    <>
      <ModalHeader>
        <ModalCloseButton />
        <ModalTitle>{lang('AttachMusic')}</ModalTitle>
      </ModalHeader>
      <div className={styles.search}>
        <SearchInput
          variant="island"
          value={query}
          placeholder={lang('SearchMusic')}
          isLoading={isSearching}
          autoFocusSearch={!IS_TOUCH_ENV}
          onChange={handleQueryChange}
        />
      </div>
    </>
  ), [lang, query, isSearching, handleQueryChange]);

  function renderRows(rows: TrackRowData[], source: PlaybackSource) {
    return rows.map(({ key, audio, item }) => (
      <MusicPickerRow
        key={key}
        audio={audio}
        item={item}
        source={source}
        onSend={handleSend}
      />
    ));
  }

  function renderEmpty(searchQuery: string) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>{lang(searchQuery ? 'NoAudioFound' : 'NoAudioFiles')}</div>
        <div className={styles.emptyDescription}>
          {searchQuery
            ? lang('NoAudioFoundInfo2', { query: searchQuery }, { withNodes: true, withMarkdown: true })
            : lang('NoAudioFilesInfo')}
        </div>
      </div>
    );
  }

  function renderSearchResults({ key: searchQuery, rows }: SearchDisplay) {
    if (!rows.length) {
      return renderEmpty(searchQuery);
    }

    return (
      <>
        <IslandTitle>{lang('AudioSearchGlobal')}</IslandTitle>
        <Island className={styles.island}>
          {renderRows(rows, SINGLE_SOURCE)}
        </Island>
      </>
    );
  }

  function renderDefaultLists() {
    if (!profileRows.length && !sharedRows.length) {
      return renderEmpty('');
    }

    return (
      <>
        {profileRows.length > 0 && profileSource && (
          <>
            <IslandTitle>{lang('AudioSearchProfile')}</IslandTitle>
            <Island className={styles.island}>
              {renderRows(profileRows, profileSource)}
              {shouldShowProfileMore && (
                <Button
                  className={styles.showMore}
                  isText
                  size="smaller"
                  noForcedUpperCase
                  onClick={handleShowMore}
                >
                  {lang('ShowMore')}
                </Button>
              )}
            </Island>
          </>
        )}
        {sharedRows.length > 0 && (
          <>
            <IslandTitle>{lang('AudioSearchChats')}</IslandTitle>
            <Island className={styles.island}>
              {renderRows(sharedRows, SINGLE_SOURCE)}
            </Island>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={closeMusicPicker}
        header={header}
        ariaLabel={lang('AttachMusic')}
        width="slim"
        dialogClassName={styles.dialog}
        contentClassName={styles.content}
      >
        <InfiniteScroll
          ref={listRef}
          scrollContainerClosest={SCROLL_CONTAINER_SELECTOR}
          items={loadMoreItems}
          cacheBuster={listGeneration}
          itemSelector={`.${styles.row}`}
          onLoadMore={handleLoadMore}
          noScrollRestore
          noFastList
        >
          <Island className={styles.filesIsland}>
            <Interactive clickable ripple className={styles.filesButton} onClick={handleSelectFromFiles}>
              {lang('AttachmentSelectFromFiles')}
            </Interactive>
          </Island>
          <Transition name="fade" activeKey={contentActiveKey} shouldCleanup onStop={handleTransitionStop}>
            {searchDisplay ? renderSearchResults(searchDisplay) : isDefaultReady ? renderDefaultLists() : undefined}
          </Transition>
        </InfiniteScroll>
      </Modal>
      {calendar}
      <PaymentMessageConfirmDialog
        isOpen={paymentMessageConfirmDialogKey === PAYMENT_DIALOG_KEY}
        onClose={closeConfirmDialog}
        userName={chat ? getPeerTitle(lang, chat) : undefined}
        messagePriceInStars={paidMessagesStars || 0}
        messagesCount={1}
        shouldAutoApprove={shouldAutoApprove}
        setAutoApprove={setAutoApprove}
        confirmHandler={dialogHandler}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const { currentUserId } = global;
    const chat = selectChat(global, modal.chatId);

    return {
      chat,
      currentUserId,
      savedMusic: currentUserId ? selectUserSavedMusic(global, currentUserId) : undefined,
      musicSearchAudiosById: global.musicSearch.audiosById,
      hasMusicSearchBot: Boolean(global.appConfig.musicSearchUsername),
      isAppConfigLoaded: global.isAppConfigLoaded,
      paidMessagesStars: selectPeerPaidMessagesStars(global, modal.chatId),
      paymentMessageConfirmDialogKey: tabState.paymentMessageConfirmDialogKey,
      starsBalance: global.stars?.balance.amount || 0,
      isStarsBalanceModalOpen: Boolean(tabState.starsBalanceModal),
      fileSizeLimit: selectCurrentLimit(global, 'uploadMaxFileparts') * MAX_UPLOAD_FILEPART_SIZE,
      isSilentPosting: chat ? getChatNotifySettings(
        chat,
        selectNotifyDefaults(global),
        selectNotifyException(global, chat.id),
      )?.isSilentPosting : undefined,
    };
  },
)(MusicPickerModal));
