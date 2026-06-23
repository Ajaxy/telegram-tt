import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import GifButton from '../../common/GifButton';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';

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
};

const INTERSECTION_DEBOUNCE = 300;

const GifPicker = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  onGifSelect,
  onGifAddCaption,
}: OwnProps & StateProps) => {
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
  const lang = useLang();

  return (
    <Transition
      ref={containerRef}
      className={buildClassName(styles.root, className, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      slideClassName={styles.grid}
      activeKey={isLoading ? 0 : 1}
      name="fade"
      shouldCleanup
    >
      {!canSendGifs ? (
        <div className={styles.pickerDisabled}>{lang('GifPickerBlocked')}</div>
      ) : canRenderContents && savedGifs && savedGifs.length ? (
        savedGifs.map((gif) => (
          <GifButton
            key={gif.id}
            gif={gif}
            className={styles.gifButton}
            observeIntersection={observeIntersection}
            isDisabled={!loadAndPlay}
            isSavedMessages={isSavedMessages}
            onClick={canSendGifs ? onGifSelect : undefined}
            onUnsaveClick={handleUnsaveClick}
            onAddCaption={canSendGifs ? onGifAddCaption : undefined}
          />
        ))
      ) : canRenderContents && savedGifs ? (
        <div className={styles.pickerDisabled}>{lang('GifPickerEmpty')}</div>
      ) : (
        <Loading className={styles.loading} color="yellow" />
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
