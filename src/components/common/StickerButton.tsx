import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, memo, useEffect, useRef,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';

import { useIsIntersecting, ObserveFn } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import buildClassName from '../../util/buildClassName';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

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

  const { transitionClassNames: previewTransitionClassNames } = useShowTransition(
    Boolean(previewBlobUrl || canAnimatedPlay),
    undefined,
    undefined,
    'slow',
  );

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
    onClick && 'interactive',
    sticker.isAnimated && 'animated',
    stickerSelector,
    className,
  );

  const style = thumbDataUri && !canAnimatedPlay ? `background-image: url('${thumbDataUri}');` : '';

  return (
    <div
      ref={ref}
      className={fullClassName}
      title={title || (sticker?.emoji)}
      // @ts-ignore
      style={style}
      data-sticker-id={sticker.id}
      onMouseDown={preventMessageInputBlurWithBubbling}
      onClick={handleClick}
    >
      {!canAnimatedPlay && (
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
