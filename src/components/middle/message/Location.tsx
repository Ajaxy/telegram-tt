import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiChat, ApiMessage, ApiUser } from '../../../api/types';
import type { ISettings } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE } from '../../../config';
import {
  getMessageLocation,
  buildStaticMapHash,
  isGeoLiveExpired,
  isOwnMessage,
  isUserId,
} from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import { formatCountdownShort, formatLastUpdated } from '../../../util/dateFormat';
import useLang from '../../../hooks/useLang';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useTimeout from '../../../hooks/useTimeout';
import {
  getMetersPerPixel, getVenueColor, getVenueIconUrl, prepareMapUrl,
} from '../../../util/map';
import buildClassName from '../../../util/buildClassName';
import usePrevious from '../../../hooks/usePrevious';
import useInterval from '../../../hooks/useInterval';
import { getServerTime } from '../../../util/serverTime';

import Avatar from '../../common/Avatar';
import Skeleton from '../../ui/Skeleton';

import mapPin from '../../../assets/map-pin.svg';
import './Location.scss';

const MOVE_THRESHOLD = 0.0001; // ~11m
const DEFAULT_MAP_CONFIG = {
  width: 400,
  height: 300,
  zoom: 16,
  scale: 2,
};

// eslint-disable-next-line max-len
const SVG_PIN = { __html: '<svg version="1.1" class="round-pin" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 64 64" style="enable-background:new 0 0 64 64;" xml:space="preserve"><g><circle cx="32" cy="32" r="24.5"/><path d="M32,8c13.23,0,24,10.77,24,24S45.23,56,32,56S8,45.23,8,32S18.77,8,32,8 M32,7C18.19,7,7,18.19,7,32s11.19,25,25,25 s25-11.19,25-25S45.81,7,32,7L32,7z"/></g><g><polygon points="29.38,57.67 27.4,56.08 30.42,54.42 32,51.54 33.58,54.42 36.6,56.08 34.69,57.61 32,60.73"/><path d="M32,52.58l1.07,1.95l0.14,0.26l0.26,0.14l2.24,1.22l-1.33,1.06l-0.07,0.06l-0.06,0.07L32,59.96l-2.24-2.61l-0.06-0.07 l-0.07-0.06l-1.33-1.06l2.24-1.22l0.26-0.14l0.14-0.26L32,52.58 M32,50.5l-1.94,3.56L26.5,56l2.5,2l3,3.5l3-3.5l2.5-2l-3.56-1.94 L32,50.5L32,50.5z"/></g></svg>' };

type OwnProps = {
  message: ApiMessage;
  peer?: ApiUser | ApiChat;
  lastSyncTime?: number;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ISettings['theme'];
  serverTimeOffset: number;
};

const Location: FC<OwnProps> = ({
  message,
  peer,
  lastSyncTime,
  isInSelectMode,
  isSelected,
  theme,
  serverTimeOffset,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const countdownRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const forceUpdate = useForceUpdate();

  const location = getMessageLocation(message)!;
  const { type, geo } = location;

  const serverTime = getServerTime(serverTimeOffset);
  const isExpired = isGeoLiveExpired(message, serverTime);
  const secondsBeforeEnd = (type === 'geoLive' && !isExpired) ? message.date + location.period - serverTime
    : undefined;

  const [point, setPoint] = useState(geo);

  const shouldRenderText = type === 'venue' || (type === 'geoLive' && !isExpired);
  const {
    width, height, zoom, scale,
  } = DEFAULT_MAP_CONFIG;

  const mediaHash = Boolean(lastSyncTime) && buildStaticMapHash(point, width, height, zoom, scale);
  const mediaBlobUrl = useMedia(mediaHash);
  const prevMediaBlobUrl = usePrevious(mediaBlobUrl);
  const mapBlobUrl = mediaBlobUrl || prevMediaBlobUrl;

  const isPeerUser = peer && isUserId(peer.id);
  const avatarUser = (peer && isPeerUser) ? peer as ApiUser : undefined;
  const avatarChat = (peer && !isPeerUser) ? peer as ApiChat : undefined;

  const isOwn = isOwnMessage(message);

  const accuracyRadiusPx = useMemo(() => {
    if (type !== 'geoLive' || !point.accuracyRadius) {
      return 0;
    }

    const { lat, accuracyRadius } = point;
    return accuracyRadius / getMetersPerPixel(lat, zoom);
  }, [type, point, zoom]);

  const handleClick = () => {
    const url = prepareMapUrl(point.lat, point.long, zoom);
    window.open(url, '_blank')?.focus();
  };

  const updateCountdown = useCallback((countdownEl: HTMLDivElement) => {
    if (type !== 'geoLive') return;
    const radius = 12;
    const circumference = radius * 2 * Math.PI;
    const svgEl = countdownEl.lastElementChild;
    const timerEl = countdownEl.firstElementChild as SVGElement;

    const timeLeft = message.date + location.period - getServerTime(serverTimeOffset);
    const strokeDashOffset = (1 - timeLeft / location.period) * circumference;
    const text = formatCountdownShort(lang, timeLeft * 1000);

    if (!svgEl || !timerEl) {
      countdownEl.innerHTML = `
        <span class="geo-countdown-text">${text}</span>
        <svg width="32px" height="32px">
          <circle cx="16" cy="16" r="${radius}" class="geo-countdown-progress" transform="rotate(-90, 16, 16)"
            stroke-dasharray="${circumference} ${circumference}"
            stroke-dashoffset="-${strokeDashOffset}"
          />
        </svg>`;
    } else {
      timerEl.textContent = text;
      svgEl.firstElementChild!.setAttribute('stroke-dashoffset', `-${strokeDashOffset}`);
    }
  }, [type, message.date, location, serverTimeOffset, lang]);

  useLayoutEffect(() => {
    if (countdownRef.current) {
      updateCountdown(countdownRef.current);
    }
  }, [updateCountdown]);

  useLayoutEffect(() => {
    if (shouldRenderText) return;
    const contentEl = ref.current!.closest<HTMLDivElement>('.message-content')!;
    if (mapBlobUrl) {
      getCustomAppendixBg(mapBlobUrl, isOwn, isInSelectMode, isSelected, theme).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.classList.add('has-appendix-thumb');
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    }
  }, [isOwn, isInSelectMode, isSelected, theme, mapBlobUrl, shouldRenderText]);

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
    const countdownEl = countdownRef.current;

    if (countdownEl) {
      updateCountdown(countdownEl);
    }
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
          {!isExpired && <div className="geo-countdown" ref={countdownRef} />}
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
        width={DEFAULT_MAP_CONFIG.width}
        height={DEFAULT_MAP_CONFIG.height}
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
        <div className={pinClassName} dangerouslySetInnerHTML={SVG_PIN}>
          <Avatar chat={avatarChat} user={avatarUser} className="location-avatar" />
          {location.heading !== undefined && (
            <div className="direction" style={`--direction: ${location.heading}deg`} />
          )}
        </div>
      );
    }

    if (type === 'venue') {
      const color = getVenueColor(location.venueType);
      const icon = getVenueIconUrl(location.venueType);
      return (
        <div className={pinClassName} dangerouslySetInnerHTML={SVG_PIN} style={`--pin-color: ${color}`}>
          <img src={icon} className="venue-icon" alt="" />
        </div>
      );
    }

    return (
      <img className={pinClassName} src={mapPin} alt="" />
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

export default memo(Location);
