import { memo, useRef } from '@teact';

import type { EditorLayer } from '../../../../types/mediaEditor';
import type { Size } from '../render/transform';

import { getStickerMediaHash } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import { isAnimatedSticker, MAX_STICKER_SIDE } from '../render/layerFrames';
import { measureLayer } from '../render/layers';

import useMedia from '../../../../hooks/useMedia';
import useDevicePixelRatio from '../../../../hooks/window/useDevicePixelRatio';

import StickerView from '../../../common/StickerView';
import OptimizedVideo from '../../OptimizedVideo';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  layer: EditorLayer;
  displaySize: Size;
  shouldAnimate?: boolean;
  noAppearAnimation?: boolean;
};

function StickerLayer({
  layer,
  displaySize,
  shouldAnimate,
  noAppearAnimation,
}: OwnProps) {
  const ref = useRef<HTMLDivElement>();
  const dpr = useDevicePixelRatio();
  const sticker = layer.sticker!;
  const isAnimated = isAnimatedSticker(sticker);
  const isStaticVideo = isAnimated && sticker.isVideo && !shouldAnimate;
  const videoUrl = useMedia(getStickerMediaHash(sticker, 'inline'), !isStaticVideo);
  const size = MAX_STICKER_SIDE / dpr;
  const scale = measureLayer(layer, displaySize).width / size;

  return (
    <div
      ref={ref}
      className={buildClassName(styles.stickerLayer, noAppearAnimation && styles.noAppearAnimation)}
      style={buildStyle(
        `left: ${layer.x * displaySize.width}px`,
        `top: ${layer.y * displaySize.height}px`,
        `width: ${size}px`,
        `height: ${size}px`,
        `transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${scale})`,
      )}
    >
      {isStaticVideo ? (
        <OptimizedVideo
          className={styles.stickerMedia}
          src={videoUrl}
          canPlay={false}
          autoPlay={false}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
        />
      ) : (
        <StickerView
          containerRef={ref}
          sticker={sticker}
          size={size}
          thumbClassName={styles.stickerMedia}
          fullMediaClassName={styles.stickerMedia}
          shouldLoop={shouldAnimate}
          noPlay={!shouldAnimate}
          skipPreview={isAnimated && !shouldAnimate}
          forceAlways
          forceOnHeavyAnimation
        />
      )}
    </div>
  );
}

export default memo(StickerLayer);
