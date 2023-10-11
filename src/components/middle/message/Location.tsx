import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage, ApiPeer } from '../../../api/types';
import type { ISettings } from '../../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  buildStaticMapHash,
  getMessageLocation,
  isGeoLiveExpired,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatCountdownShort, formatLastUpdated } from '../../../util/dateFormat';
import {
  getMetersPerPixel, getVenueColor, getVenueIconUrl,
} from '../../../util/map';
import { getServerTime } from '../../../util/serverTime';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useInterval from '../../../hooks/useInterval';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import usePrevious from '../../../hooks/usePrevious';
import useTimeout from '../../../hooks/useTimeout';

import Avatar from '../../common/Avatar';
import Skeleton from '../../ui/placeholder/Skeleton';

import './Location.scss';

import mapPin from '../../../assets/map-pin.svg';

const TIMER_RADIUS = 12;
const TIMER_CIRCUMFERENCE = TIMER_RADIUS * 2 * Math.PI;
const MOVE_THRESHOLD = 0.0001; // ~11m
const DEFAULT_MAP_CONFIG = {
  width: 400,
  height: 300,
  zoom: 16,
  scale: 2,
};

type OwnProps = {
  message: ApiMessage;
  peer?: ApiPeer;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ISettings['theme'];
};

const Location: FC<OwnProps> = ({
  message,
  peer,
}) => {
  const { openMapModal } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const countdownRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const forceUpdate = useForceUpdate();

  const location = getMessageLocation(message)!;
  const { type, geo } = location;

  const serverTime = getServerTime();
  const isExpired = isGeoLiveExpired(message);
  const secondsBeforeEnd = (type === 'geoLive' && !isExpired) ? message.date + location.period - serverTime
    : undefined;

  const [point, setPoint] = useState(geo);

  const shouldRenderText = type === 'venue' || (type === 'geoLive' && !isExpired);
  const {
    width, height, zoom, scale,
  } = DEFAULT_MAP_CONFIG;

  const mediaHash = buildStaticMapHash(point, width, height, zoom, scale);
  const mediaBlobUrl = useMedia(mediaHash);
  const prevMediaBlobUrl = usePrevious(mediaBlobUrl, true);
  const mapBlobUrl = mediaBlobUrl || prevMediaBlobUrl;

  const accuracyRadiusPx = useMemo(() => {
    if (type !== 'geoLive' || !point.accuracyRadius) {
      return 0;
    }

    const { lat, accuracyRadius } = point;
    return accuracyRadius / getMetersPerPixel(lat, zoom);
  }, [type, point, zoom]);

  const handleClick = () => {
    openMapModal({ geoPoint: point, zoom });
  };

  const updateCountdown = useLastCallback((countdownEl: HTMLDivElement) => {
    if (type !== 'geoLive') return;
    const svgEl = countdownEl.lastElementChild!;
    const timerEl = countdownEl.firstElementChild!;

    const timeLeft = message.date + location.period - getServerTime();
    const strokeDashOffset = (1 - timeLeft / location.period) * TIMER_CIRCUMFERENCE;
    const text = formatCountdownShort(lang, timeLeft * 1000);
    timerEl.textContent = text;
    svgEl.firstElementChild!.setAttribute('stroke-dashoffset', `-${strokeDashOffset}`);
  });

  useLayoutEffect(() => {
    if (countdownRef.current) {
      updateCountdown(countdownRef.current);
    }
  }, [updateCountdown]);

  useEffect(() => {
    // Prevent map refetching for slight location changes
    if (Math.abs(geo.lat - point.lat) < MOVE_THRESHOLD && Math.abs(geo.long - point.long) < MOVE_THRESHOLD) {
      if (point.accuracyRadius !== geo.accuracyRadius) {
        setPoint({
          ...point,
          accuracyRadius: geo.accuracyRadius,
        });
      }
      return;
    }
    setPoint(geo);
  }, [geo, point]);

  useTimeout(() => {
    forceUpdate();
  }, !isExpired ? (secondsBeforeEnd || 0) * 1000 : undefined);

  useInterval(() => {
    requestMutation(() => {
      const countdownEl = countdownRef.current;
      if (countdownEl) {
        updateCountdown(countdownEl);
      }
    });
  }, secondsBeforeEnd ? 1000 : undefined);

  function renderInfo() {
    if (!shouldRenderText) return undefined;
    if (type === 'venue') {
      return (
        <div className="location-info">
          <div className="location-info-title">
            {location.title}
          </div>
          <div className="location-info-subtitle">
            {location.address}
          </div>
        </div>
      );
    }
    if (type === 'geoLive') {
      return (
        <div className="location-info">
          <div className="location-info-title">{lang('AttachLiveLocation')}</div>
          <div className="location-info-subtitle">
            {formatLastUpdated(lang, serverTime, message.editDate)}
          </div>
          {!isExpired && (
            <div className="geo-countdown" ref={countdownRef}>
              <span className="geo-countdown-text" />
              <svg width="32px" height="32px">
                <circle
                  cx="16"
                  cy="16"
                  r={TIMER_RADIUS}
                  className="geo-countdown-progress"
                  transform="rotate(-90, 16, 16)"
                  stroke-dasharray={TIMER_CIRCUMFERENCE}
                  stroke-dashoffset="0"
                />
              </svg>
            </div>
          )}
        </div>
      );
    }
    return undefined;
  }

  function renderMap() {
    if (!mapBlobUrl) return <Skeleton width={width} height={height} />;
    return (
      <img
        className="full-media map"
        src={mapBlobUrl}
        alt="Location on a map"
        draggable={false}
        style={`width: ${DEFAULT_MAP_CONFIG.width}px; height: ${DEFAULT_MAP_CONFIG.height}px;`}
      />
    );
  }

  function renderPin() {
    const pinClassName = buildClassName(
      'pin',
      type,
      isExpired && 'expired',
    );
    if (type === 'geoLive') {
      return (
        <div className={pinClassName}>
          <PinSvg />
          <Avatar peer={peer} className="location-avatar" />
          {location.heading !== undefined && (
            <div className="direction" style={`--direction: ${location.heading}deg`} />
          )}
        </div>
      );
    }

    if (type === 'venue') {
      const color = getVenueColor(location.venueType);
      const iconSrc = getVenueIconUrl(location.venueType);
      if (iconSrc) {
        return (
          <div className={pinClassName} style={`--pin-color: ${color}`}>
            <PinSvg />
            <img src={iconSrc} draggable={false} className="venue-icon" alt="" />
          </div>
        );
      }
    }

    return (
      <img className={pinClassName} draggable={false} src={mapPin} alt="" />
    );
  }

  function renderOverlay() {
    if (!mapBlobUrl) return undefined;

    return (
      <>
        {Boolean(accuracyRadiusPx) && !isExpired && (
          <div
            className="location-accuracy"
            style={`width: ${accuracyRadiusPx * 2}px; height: ${accuracyRadiusPx * 2}px`}
          />
        )}
        {renderPin()}
      </>
    );
  }

  return (
    <div
      ref={ref}
      className="Location media-inner interactive"
      onClick={handleClick}
    >
      <div className="map-wrapper">
        {renderMap()}
        {renderOverlay()}
      </div>
      {renderInfo()}
    </div>
  );
};

function PinSvg() {
  return (
    <svg className="round-pin" style="enable-background:new 0 0 64 64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="24.5" />
      <path d="M32 8c13.23 0 24 10.77 24 24S45.23 56 32 56 8 45.23 8 32 18.77 8 32 8m0-1C18.19 7 7 18.19 7 32s11.19 25 25 25 25-11.19 25-25S45.81 7 32 7z" />
      <path d="m29.38 57.67-1.98-1.59 3.02-1.66L32 51.54l1.58 2.88 3.02 1.66-1.91 1.53L32 60.73z" />
      <path d="m32 52.58 1.07 1.95.14.26.26.14 2.24 1.22-1.33 1.06-.07.06-.06.07L32 59.96l-2.24-2.61-.06-.07-.07-.06-1.33-1.06 2.24-1.22.26-.14.14-.26L32 52.58m0-2.08-1.94 3.56L26.5 56l2.5 2 3 3.5 3-3.5 2.5-2-3.56-1.94L32 50.5z" />
    </svg>
  );
}

export default memo(Location);
