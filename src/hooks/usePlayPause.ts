import { useCallback, useRef } from '../lib/teact/teact';

export default function usePlayPause(mediaRef: React.RefObject<HTMLMediaElement>) {
  const shouldPauseRef = useRef(false);
  const isLoadingPlayRef = useRef(false);

  const play = useCallback(() => {
    shouldPauseRef.current = false;
    if (mediaRef.current && !isLoadingPlayRef.current && document.body.contains(mediaRef.current)) {
      isLoadingPlayRef.current = true;
      mediaRef.current.play().then(() => {
        isLoadingPlayRef.current = false;
        if (shouldPauseRef.current) {
          mediaRef.current?.pause();
          shouldPauseRef.current = false;
        }
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(e);
      });
    }
  }, [mediaRef]);

  const pause = useCallback(() => {
    if (isLoadingPlayRef.current) {
      shouldPauseRef.current = true;
    } else {
      mediaRef.current?.pause();
    }
  }, [mediaRef]);

  return { play, pause };
}
