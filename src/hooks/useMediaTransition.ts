import useShowTransition from './useShowTransition';

export default function useMediaTransition(mediaData?: any) {
  const isMediaReady = Boolean(mediaData);
  const { transitionClassNames } = useShowTransition(isMediaReady, undefined, isMediaReady, 'slow');

  return transitionClassNames;
}
