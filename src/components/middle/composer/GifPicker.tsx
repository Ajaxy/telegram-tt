import {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiEmojiGroup, ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getGridCornerClassName } from '../../../util/gridCorners';
import resetScroll from '../../../util/resetScroll';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useGifSearch from './hooks/useGifSearch';

import GifButton from '../../common/GifButton';
import Transition from '../../ui/Transition';
import EmojiSearch from './EmojiSearch';

import styles from './GifPicker.module.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs?: boolean;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onGifAddCaption?: (gif: ApiVideo) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
  isSavedMessages?: boolean;
  emojiGroups?: ApiEmojiGroup[];
};

const INTERSECTION_DEBOUNCE = 300;
const LOAD_MORE_THRESHOLD = 500;

const GifPicker = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  emojiGroups,
  onGifSelect,
  onGifAddCaption,
}: OwnProps & StateProps) => {
  const { loadSavedGifs, saveGif } = getActions();

  const containerRef = useRef<HTMLDivElement>();

  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<ApiEmojiGroup>();

  const lang = useLang();

  const effectiveQuery = activeGroup ? activeGroup.emoticons.join('') : query.trim();
  const isSearchActive = Boolean(effectiveQuery);

  const { results: searchResults, searchMore } = useGifSearch({ query: effectiveQuery || undefined });

  const displayRef = useRef<{ key: string; results: ApiVideo[] }>();
  if (isSearchActive && searchResults?.key === effectiveQuery) {
    displayRef.current = { key: effectiveQuery, results: searchResults.gifs };
  }
  const display = isSearchActive ? displayRef.current : undefined;
  const isShowingResults = Boolean(display);
  const isSearchLoading = isSearchActive && display?.key !== effectiveQuery;

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  useLayoutEffect(() => {
    if (containerRef.current) {
      resetScroll(containerRef.current, 0);
    }
  }, [isShowingResults, display?.key]);

  const handleUnsaveClick = useLastCallback((gif: ApiVideo) => {
    saveGif({ gif, shouldUnsave: true });
  });

  const handleQueryChange = useLastCallback((value: string) => {
    setQuery(value);
    if (activeGroup) {
      setActiveGroup(undefined);
    }
  });

  const handleGroupSelect = useLastCallback((group?: ApiEmojiGroup) => {
    setActiveGroup(group);
    if (query) {
      setQuery('');
    }
  });

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!isSearchActive) {
      return;
    }

    const container = e.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < LOAD_MORE_THRESHOLD) {
      searchMore();
    }
  });

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const isLoading = canSendGifs && (!canRenderContents || !savedGifs);

  const contentActiveKey = useTransitionActiveKey([isShowingResults, display?.key, isLoading]);

  function renderGifs(gifs: ApiVideo[], isSaved?: boolean) {
    return gifs.map((gif, index) => (
      <GifButton
        key={gif.id}
        gif={gif}
        className={buildClassName(styles.gifButton, getGridCornerClassName(index, gifs.length))}
        observeIntersection={observeIntersection}
        isDisabled={!loadAndPlay}
        noSpinner
        isSavedMessages={isSavedMessages}
        onClick={canSendGifs ? onGifSelect : undefined}
        onUnsaveClick={isSaved ? handleUnsaveClick : undefined}
        onAddCaption={canSendGifs ? onGifAddCaption : undefined}
      />
    ));
  }

  function renderContent() {
    if (!canSendGifs) {
      return <div className={styles.pickerDisabled}>{lang('GifPickerBlocked')}</div>;
    }

    if (isShowingResults) {
      if (!display.results.length) {
        return <div className={styles.pickerDisabled}>{lang('NoGIFsFound')}</div>;
      }
      return renderGifs(display.results);
    }

    if (canRenderContents && savedGifs && savedGifs.length) {
      return renderGifs(savedGifs, true);
    }

    if (canRenderContents && savedGifs) {
      return <div className={styles.pickerDisabled}>{lang('GifPickerEmpty')}</div>;
    }

    return undefined;
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, className, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      onScroll={handleScroll}
    >
      {canSendGifs && (
        <EmojiSearch
          value={query}
          groups={emojiGroups}
          activeGroup={activeGroup}
          placeholder={lang('SearchGifsTitle')}
          isLoading={isSearchLoading || isLoading}
          className={styles.search}
          onChange={handleQueryChange}
          onGroupSelect={handleGroupSelect}
        />
      )}
      <Transition
        name="fade"
        activeKey={contentActiveKey}
        className={styles.contentTransition}
        slideClassName={styles.grid}
        shouldCleanup
      >
        {renderContent()}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    return {
      savedGifs: global.gifs.saved.gifs,
      isSavedMessages,
      emojiGroups: global.emojiGroups?.groups,
    };
  },
)(GifPicker));
