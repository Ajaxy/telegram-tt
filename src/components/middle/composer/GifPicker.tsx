import React, {
  FC, useEffect, memo, useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Loading from '../../ui/Loading';
import GifButton from '../../common/GifButton';

import './GifPicker.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs: boolean;
  onGifSelect: (gif: ApiVideo) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
};

type DispatchProps = Pick<GlobalActions, 'loadSavedGifs'>;

const INTERSECTION_DEBOUNCE = 300;

const GifPicker: FC<OwnProps & StateProps & DispatchProps> = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  onGifSelect,
  loadSavedGifs,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  return (
    <div ref={containerRef} className={buildClassName('GifPicker no-scrollbar', className)}>
      {!canSendGifs ? (
        <div className="picker-disabled">Sending GIFs is not allowed in this chat.</div>
      ) : canRenderContents && savedGifs && savedGifs.length ? (
        savedGifs.map((gif) => (
          <GifButton
            key={gif.id}
            gif={gif}
            observeIntersection={observeIntersection}
            isDisabled={!loadAndPlay}
            onClick={onGifSelect}
          />
        ))
      ) : canRenderContents && savedGifs ? (
        <div className="picker-disabled">No saved GIFs.</div>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      savedGifs: global.gifs.saved.gifs,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadSavedGifs']),
)(GifPicker));
