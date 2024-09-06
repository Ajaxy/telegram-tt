import useShowTransition from './useShowTransition';

export default function useMediaTransition<RefType extends HTMLElement = HTMLDivElement>(
  mediaData?: unknown,
  options?: Partial<Parameters<typeof useShowTransition<RefType>>[0]>,
) {
  const isMediaReady = Boolean(mediaData);

  const { ref } = useShowTransition<RefType>({
    isOpen: isMediaReady,
    noMountTransition: isMediaReady,
    className: 'slow',
    ...options,
  });

  return ref;
}
