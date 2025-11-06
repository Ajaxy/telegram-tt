import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getStickerMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { preloadImage } from '../../../util/files';
import { REM } from '../helpers/mediaDimensions';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import { useThrottleForHeavyAnimation } from '../../../hooks/useHeavyAnimation';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';
import useCustomEmoji from '../hooks/useCustomEmoji';

import styles from './EmojiIconBackground.module.scss';

type IconPosition = {
  inline: number;
  block: number;
  opacity: number;
  scale: number;
};

const ICON_POSITIONS: IconPosition[] = [
  {
    inline: 22, block: 38, opacity: 0.35, scale: 0.75,
  },
  {
    inline: 32, block: 12, opacity: 0.3, scale: 1,
  },
  {
    inline: 60, block: 22, opacity: 0.25, scale: 0.75,
  },
  {
    inline: 75, block: 44, opacity: 0.25, scale: 1,
  },
  {
    inline: 75, block: 2, opacity: 0.2, scale: 0.625,
  },
  {
    inline: 95, block: 18, opacity: 0.2, scale: 1,
  },
  {
    inline: 115, block: 38, opacity: 0.2, scale: 0.625,
  },
  {
    inline: 125, block: 12, opacity: 0.1, scale: 0.75,
  },
];

const EMOJI_SIZE = REM;
const LOTTIE_TINT_OPACITY = 'ff';
const NON_LOTTIE_TINT_OPACITY = 'bb';
const EMOJI_SPACE = 0.75 * REM;

type OwnProps = {
  emojiDocumentId: string;
  className?: string;
  withEmojiSpace?: boolean;
};

const EmojiIconBackground = ({
  emojiDocumentId,
  className,
  withEmojiSpace,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const containerRef = useRef<HTMLDivElement>();

  const [emojiImage, setEmojiImage] = useState<HTMLImageElement | undefined>();

  const dpr = useDevicePixelRatio();

  const lang = useOldLang();

  const { customEmoji } = useCustomEmoji(emojiDocumentId);
  const previewMediaHash = customEmoji ? getStickerMediaHash(customEmoji, 'preview') : undefined;
  const previewUrl = useMedia(previewMediaHash);

  const customColor = useDynamicColorListener(containerRef);

  const preloadAfterHeavyAnimation = useThrottleForHeavyAnimation(() => {
    if (!previewUrl) return;
    preloadImage(previewUrl).then(setEmojiImage);
  }, [previewUrl]);

  useEffect(() => {
    preloadAfterHeavyAnimation();
  }, [preloadAfterHeavyAnimation]);

  const updateCanvas = useLastCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !emojiImage || !customColor) return;

    const context = canvas.getContext('2d')!;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);

    ICON_POSITIONS.forEach(({
      inline, block, opacity, scale,
    }) => {
      const xShift = withEmojiSpace ? -EMOJI_SPACE : 0;
      const x = ((lang.isRtl ? inline : width / dpr - inline) + xShift) * dpr;
      const y = block * dpr;

      const emojiSize = EMOJI_SIZE * dpr;

      context.save();
      context.globalAlpha = opacity;
      context.translate(x, y);
      context.scale(scale, scale);
      context.drawImage(emojiImage, -emojiSize / 2, -emojiSize / 2, emojiSize, emojiSize);
      context.restore();
    });

    const tintColor = `${customColor}${customEmoji!.isLottie ? LOTTIE_TINT_OPACITY : NON_LOTTIE_TINT_OPACITY}`;

    context.save();
    context.fillStyle = tintColor;
    context.globalCompositeOperation = 'source-atop';
    context.fillRect(0, 0, width, height);
    context.restore();
  });

  const updateCanvasAfterHeavyAnimation = useThrottleForHeavyAnimation(updateCanvas, [updateCanvas]);

  useEffect(() => {
    updateCanvasAfterHeavyAnimation();
  }, [emojiImage, lang.isRtl, customColor, updateCanvasAfterHeavyAnimation, withEmojiSpace]);

  const updateCanvasSize = useThrottleForHeavyAnimation((parentWidth: number, parentHeight: number) => {
    requestMutation(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = parentWidth * dpr;
      canvas.height = parentHeight * dpr;

      canvas.style.width = `${parentWidth}px`;
      canvas.style.height = `${parentHeight}px`;

      updateCanvas();
    });
  }, [dpr]);

  const handleResize = useThrottleForHeavyAnimation((entry: ResizeObserverEntry) => {
    const { width, height } = entry.contentRect;

    updateCanvasSize(width, height);
  }, [updateCanvasSize]);

  useResizeObserver(containerRef, handleResize);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();

    updateCanvasSize(width, height);
  }, [updateCanvasSize]);

  return (
    <div className={buildClassName(styles.root, className)} ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default memo(EmojiIconBackground);
