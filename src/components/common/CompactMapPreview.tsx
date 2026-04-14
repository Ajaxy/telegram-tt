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
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

const DEFAULT_ZOOM = 15;

const CompactMapPreview = ({
  className,
  geo,
  width,
  height,
  zoom = DEFAULT_ZOOM,
  shouldShowPin = true,
  onClick,
}: OwnProps) => {
  const dpr = useDevicePixelRatio();
  const mediaHash = buildStaticMapHash(geo, width, height, zoom, dpr);
  const mapBlobUrl = useMedia(mediaHash);

  return (
    <div
      className={buildClassName(styles.root, onClick && styles.interactive, className)}
      style={`width: ${width}px; height: ${height}px;`}
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
        <Skeleton className={styles.skeleton} width={width} height={height} animation="wave" />
      )}
      {shouldShowPin && <img src={mapPin} alt="" className={styles.pin} draggable={false} />}
    </div>
  );
};

export default memo(CompactMapPreview);
