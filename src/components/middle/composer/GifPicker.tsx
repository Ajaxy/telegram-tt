import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import GifButton from '../../common/GifButton';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';

import './GifPicker.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs?: boolean;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
  isSavedMessages?: boolean;
};

const INTERSECTION_DEBOUNCE = 300;

const GifPicker: FC<OwnProps & StateProps> = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  onGifSelect,
}) => {
  const { loadSavedGifs, saveGif } = getActions();

  const containerRef = useRef<HTMLDivElement>();

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  const handleUnsaveClick = useLastCallback((gif: ApiVideo) => {
    saveGif({ gif, shouldUnsave: true });
  });

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const isLoading = canSendGifs && (!canRenderContents || !savedGifs);

  return (
    <Transition
      ref={containerRef}
      className={buildClassName('GifPicker', className, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      slideClassName="GifPickerGrid"
      activeKey={isLoading ? 0 : 1}
      name="fade"
      shouldCleanup
    >
      {!canSendGifs ? (
        <div className="picker-disabled">Sending GIFs is not allowed in this chat.</div>
      ) : canRenderContents && savedGifs && savedGifs.length ? (
        savedGifs.map((gif) => (
          <GifButton
            key={gif.id}
            gif={gif}
            observeIntersection={observeIntersection}
            isDisabled={!loadAndPlay}
            onClick={canSendGifs ? onGifSelect : undefined}
            onUnsaveClick={handleUnsaveClick}
            isSavedMessages={isSavedMessages}
          />
        ))
      ) : canRenderContents && savedGifs ? (
        <div className="picker-disabled">No saved GIFs.</div>
      ) : (
        <Loading color="yellow" />
      )}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);
    return {
      savedGifs: global.gifs.saved.gifs,
      isSavedMessages,
    };
  },
)(GifPicker));
