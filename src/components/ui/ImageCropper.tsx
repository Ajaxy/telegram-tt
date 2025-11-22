import { memo, useMemo, useRef, useState } from '../../lib/teact/teact';

import buildStyle from '../../util/buildStyle';
import getPointerPosition from '../../util/events/getPointerPosition';
import { blobToFile } from '../../util/files';
import { clamp } from '../../util/math';
import { REM } from '../common/helpers/mediaDimensions';

import useLastCallback from '../../hooks/useLastCallback';
import useWindowSize from '../../hooks/window/useWindowSize';

import Button from './Button';
import RangeSlider from './RangeSlider';

import styles from './ImageCropper.module.scss';

type OwnProps = {
  onChange: (file: File) => void;
  image?: HTMLImageElement;
  maxOutputSize: number;
  minOutputSize: number;
};

const PREVIEW_SIZE = 400;
const MIN_ZOOM = 100;
const MAX_ZOOM = 200;
const CROP_AREA_INSET = 0.125 * REM;
const MODAL_INLINE_PADDING = REM * 2;

const ImageCropper = ({
  onChange,
  image,
  maxOutputSize,
  minOutputSize,
}: OwnProps) => {
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const isDragging = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const lastImagePosition = useRef({ x: 0, y: 0 });

  const { width: windowWidth } = useWindowSize();
  const previewContainerSize = Math.min(PREVIEW_SIZE, windowWidth - MODAL_INLINE_PADDING * 2);
  const scaleFactor = image
    ? Math.max(
      previewContainerSize / image.width,
      previewContainerSize / image.height,
    ) : 1;
  const zoomFactor = scaleFactor * zoom / 100;

  const previewImageSize = useMemo(() => {
    if (!image) return { width: 0, height: 0 };
    return {
      width: image.width * zoomFactor,
      height: image.height * zoomFactor,
    };
  }, [image, zoomFactor]);

  const clampPosition = (x: number, y: number, previewSize: { width: number; height: number }) => {
    const radius = previewContainerSize / 2;
    const imgHalfWidth = previewSize.width / 2;
    const imgHalfHeight = previewSize.height / 2;

    const maxOffsetX = Math.max(0, imgHalfWidth - radius);
    const maxOffsetY = Math.max(0, imgHalfHeight - radius);

    return {
      x: clamp(x, -maxOffsetX, maxOffsetX),
      y: clamp(y, -maxOffsetY, maxOffsetY),
    };
  };

  const startDrag = (e: any) => {
    isDragging.current = true;
    lastMousePosition.current = getPointerPosition(e);
    lastImagePosition.current = { ...imagePosition };
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
  };
  const moveDrag = useLastCallback((e: any) => {
    if ('touches' in e && e.touches.length > 1) return;
    if (!isDragging.current) return;
    const { x: mouseX, y: mouseY } = getPointerPosition(e);
    const deltaX = mouseX - lastMousePosition.current.x;
    const deltaY = mouseY - lastMousePosition.current.y;
    const newPosition = clampPosition(
      lastImagePosition.current.x + deltaX,
      lastImagePosition.current.y + deltaY,
      previewImageSize,
    );
    setImagePosition(newPosition);
  });
  const endDrag = useLastCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('touchmove', moveDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);
  });

  const handleZoomChange = useLastCallback((newZoom: number) => {
    const newZoomFactor = scaleFactor * newZoom / 100;
    const newPreviewImageSize = {
      width: image!.width * newZoomFactor,
      height: image!.height * newZoomFactor,
    };

    const ratio = newZoom / zoom;
    const newPosition = clampPosition(
      imagePosition.x * ratio,
      imagePosition.y * ratio,
      newPreviewImageSize,
    );

    setZoom(newZoom);
    setImagePosition(newPosition);
  });

  const handleCrop = () => {
    if (!image) return;

    const cropSize = previewContainerSize / zoomFactor;
    const cropX = (image.width / 2) - (cropSize / 2) - (imagePosition.x / zoomFactor);
    const cropY = (image.height / 2) - (cropSize / 2) - (imagePosition.y / zoomFactor);

    const outputSize = Math.min(maxOutputSize, Math.max(minOutputSize, cropSize));

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      cropX, cropY,
      cropSize, cropSize,
      0, 0,
      outputSize, outputSize,
    );
    canvas.toBlob((blob) => {
      if (blob) onChange(blobToFile(blob, 'avatar.jpg'));
    }, 'image/jpeg');
  };

  if (!image) return undefined;

  const imageLeft = (previewContainerSize - previewImageSize.width) / 2 + imagePosition.x;
  const imageTop = (previewContainerSize - previewImageSize.height) / 2 + imagePosition.y;
  const backgroundImageStyle = buildStyle(
    `width: ${previewImageSize.width}px`,
    `height: ${previewImageSize.height}px`,
    `left: ${imageLeft}px`,
    `top: ${imageTop}px`,
  );

  const foregroundImageStyle = buildStyle(
    `width: ${previewImageSize.width}px`,
    `height: ${previewImageSize.height}px`,
    `left: ${imageLeft - CROP_AREA_INSET}px`,
    `top: ${imageTop - CROP_AREA_INSET}px`,
  );

  return (
    <div>
      <div
        className={styles.previewContainer}
        style={buildStyle(
          `width: ${previewContainerSize}px`,
          `height: ${previewContainerSize}px`,
        )}
      >
        <img
          src={image.src}
          className={styles.backgroundImage}
          style={backgroundImageStyle}
          draggable={false}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          alt=""
          role="presentation"
        />
        <div className={styles.previewMask} />
        <div className={styles.cropArea}>
          <img
            src={image.src}
            className={styles.foregroundImage}
            style={foregroundImageStyle}
            draggable={false}
            alt=""
            role="presentation"
          />
        </div>
      </div>
      <div className={styles.bottomControls}>
        <RangeSlider
          className={styles.zoomSlider}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          value={zoom}
          onChange={handleZoomChange}
        />
        <Button
          className={styles.confirmButton}
          round
          color="primary"
          iconName="check"
          onClick={handleCrop}
          ariaLabel="Crop"
        />
      </div>
    </div>
  );
};

export default memo(ImageCropper);
