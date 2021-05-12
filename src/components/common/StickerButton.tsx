import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, memo, useEffect, useRef,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';

import { useIsIntersecting, ObserveFn } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useTransitionForMedia from '../../hooks/useTransitionForMedia';
import useFlag from '../../hooks/useFlag';
import buildClassName from '../../util/buildClassName';

import AnimatedSticker from './AnimatedSticker';
import Button from '../ui/Button';

import './StickerButton.scss';

type OwnProps = {
  sticker: ApiSticker;
  size: number;
  observeIntersection: ObserveFn;
  noAnimate?: boolean;
  title?: string;
  className?: string;
  onClick?: (arg: any) => void;
  clickArg?: any;
  onUnfaveClick?: (sticker: ApiSticker) => void;
};

const StickerButton: FC<OwnProps> = ({
  sticker, size, observeIntersection, noAnimate, title, className, onClick, clickArg, onUnfaveClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const localMediaHash = `sticker${sticker.id}`;
  const stickerSelector = `sticker-button-${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const thumbDataUri = sticker.thumbnail ? sticker.thumbnail.dataUri : undefined;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !isIntersecting, ApiMediaFormat.BlobUrl);

  const shouldPlay = isIntersecting && !noAnimate;
  const lottieData = useMedia(sticker.isAnimated && localMediaHash, !shouldPlay, ApiMediaFormat.Lottie);
  const [isAnimationLoaded, markLoaded, unmarkLoaded] = useFlag(Boolean(lottieData));
  const canAnimatedPlay = isAnimationLoaded && shouldPlay;

  const {
    shouldRenderThumb,
    shouldRenderFullMedia: shouldRenderPreview,
    transitionClassNames: previewTransitionClassNames,
  } = useTransitionForMedia(previewBlobUrl || canAnimatedPlay, 'slow');

  // To avoid flickering
  useEffect(() => {
    if (!shouldPlay) {
      unmarkLoaded();
    }
  }, [unmarkLoaded, shouldPlay]);

  function handleClick() {
    if (onClick) {
      onClick(clickArg);
    }
  }

  function handleUnfaveClick(e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    e.preventDefault();

    onUnfaveClick!(sticker);
  }

  const fullClassName = buildClassName(
    'StickerButton',
    sticker.isAnimated && 'animated',
    stickerSelector,
    className,
  );

  const style = shouldRenderThumb && thumbDataUri ? `background-image: url('${thumbDataUri}');` : '';

  return (
    <div
      ref={ref}
      className={fullClassName}
      title={title || (sticker && sticker.emoji)}
      // @ts-ignore
      style={style}
      data-sticker-id={sticker.id}
      onClick={handleClick}
    >
      {shouldRenderPreview && !canAnimatedPlay && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={previewBlobUrl} className={previewTransitionClassNames} />
      )}
      {shouldPlay && lottieData && (
        <AnimatedSticker
          id={localMediaHash}
          animationData={lottieData}
          play
          size={size}
          isLowPriority
          onLoad={markLoaded}
        />
      )}
      {onUnfaveClick && (
        <Button
          className="sticker-unfave-button"
          color="dark"
          round
          onClick={handleUnfaveClick}
        >
          <i className="icon-close" />
        </Button>
      )}
    </div>
  );
};

export default memo(StickerButton);
