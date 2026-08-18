import { memo } from '../../lib/teact/teact';

import type { ApiGeoPoint } from '../../api/types';

import { buildStaticMapHash } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useMedia from '../../hooks/useMedia';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import Skeleton from '../ui/placeholder/Skeleton';

import styles from './CompactMapPreview.module.scss';

import mapPin from '../../assets/map-pin.svg';

type OwnProps = {
  className?: string;
  geo: ApiGeoPoint;
  width: number;
  height: number;
  zoom?: number;
  shouldShowPin?: boolean;
  isFullWidth?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

const DEFAULT_ZOOM = 15;
const FULL_WIDTH_MAP_REQUEST_WIDTH = 480;

const CompactMapPreview = ({
  className,
  geo,
  width,
  height,
  zoom = DEFAULT_ZOOM,
  shouldShowPin,
  isFullWidth,
  onClick,
}: OwnProps) => {
  const dpr = useDevicePixelRatio();
  const requestWidth = isFullWidth ? FULL_WIDTH_MAP_REQUEST_WIDTH : width;
  const requestHeight = isFullWidth ? Math.round(height * requestWidth / width) : height;
  const mediaHash = buildStaticMapHash(geo, requestWidth, requestHeight, zoom, dpr);
  const mapBlobUrl = useMedia(mediaHash);
  const style = isFullWidth
    ? `--map-aspect-ratio: ${width / height}`
    : `width: ${width}px; height: ${height}px;`;

  return (
    <div
      className={buildClassName(styles.root, isFullWidth && styles.fullWidth, onClick && styles.interactive, className)}
      style={style}
      onClick={onClick}
    >
      {mapBlobUrl ? (
        <img
          src={mapBlobUrl}
          alt=""
          className={styles.map}
          draggable={false}
        />
      ) : (
        <Skeleton
          className={styles.skeleton}
          width={isFullWidth ? undefined : width}
          height={isFullWidth ? undefined : height}
          animation="wave"
        />
      )}
      {shouldShowPin && <img src={mapPin} alt="" className={styles.pin} draggable={false} />}
    </div>
  );
};

export default memo(CompactMapPreview);
