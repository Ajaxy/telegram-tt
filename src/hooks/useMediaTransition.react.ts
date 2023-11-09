import useShowTransition from './useShowTransition';

export default function useMediaTransition(mediaData?: unknown) {
  const isMediaReady = Boolean(mediaData);
  const { transitionClassNames } = useShowTransition(isMediaReady, undefined, isMediaReady, 'slow');

  return transitionClassNames;
}
