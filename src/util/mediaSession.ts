export type MediaSessionHandlers = {
  play?: () => void;
  pause?: () => void;
  stop?: () => void;

  previoustrack?: () => void;
  nexttrack?: () => void;

  togglemicrophone?: () => void;
  togglecamera?: () => void;
  hangup?: () => void;

  seekbackward?: (details: MediaSessionActionDetails) => void;
  seekforward?: (details: MediaSessionActionDetails) => void;
  seekTo?: ((details: MediaSessionActionDetails) => void);
};

interface MediaMetadataParameters {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaImage[];
}

const DEFAULT_HANDLERS = {
  play: undefined,
  pause: undefined,
  seekbackward: undefined,
  seekforward: undefined,
  previoustrack: undefined,
  nexttrack: undefined,
  stop: undefined,
  seekTo: undefined,
};

export function registerMediaSession(metadata?: MediaMetadata, handlers?: MediaSessionHandlers) {
  const { mediaSession } = window.navigator;
  if (mediaSession) {
    if (metadata) updateMetadata(metadata);
    if (handlers) setMediaSessionHandlers(handlers);
  } else {
    // eslint-disable-next-line no-console
    console.warn('MediaSession API not supported in this browser');
  }
}

export function updateMetadata(metadata?: MediaMetadata) {
  const { mediaSession } = window.navigator;
  if (mediaSession) {
    // eslint-disable-next-line no-null/no-null
    mediaSession.metadata = metadata ?? null;
  }
}

export function setMediaSessionHandlers(handlers: MediaSessionHandlers) {
  const { mediaSession } = window.navigator;
  if (mediaSession) {
    Object.entries({ ...DEFAULT_HANDLERS, ...handlers }).forEach(([key, handler]) => {
      try {
        // @ts-ignore API not standardized yet
        mediaSession.setActionHandler(key, handler);
      } catch (err) {
        // Handler not supported, ignoring
      }
    });
  }
}

export function clearMediaSession() {
  const { mediaSession } = window.navigator;
  if (mediaSession) {
    // eslint-disable-next-line no-null/no-null
    mediaSession.metadata = null;
    setMediaSessionHandlers(DEFAULT_HANDLERS);
    if (mediaSession.playbackState) mediaSession.playbackState = 'none';
    mediaSession.setPositionState?.();
  }
}

export function setPlaybackState(state: 'none' | 'paused' | 'playing' = 'none') {
  const { mediaSession } = window.navigator;
  if (mediaSession && mediaSession.playbackState) {
    mediaSession.playbackState = state;
  }
}

export function setPositionState(state?: MediaPositionState) {
  if (!state || state.position === undefined || state.duration === undefined) return;
  state.position = Math.min(state.position, state.duration);

  const { mediaSession } = window.navigator;
  mediaSession?.setPositionState?.(state);
}

export function buildMediaMetadata({
  title, artist, album, artwork,
}: MediaMetadataParameters) {
  if ('MediaMetadata' in window) {
    return new window.MediaMetadata({
      title,
      artist,
      album,
      artwork,
    });
  }
  return undefined;
}
