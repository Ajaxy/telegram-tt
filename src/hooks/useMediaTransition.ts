import useShowTransition, { type HookParams } from './useShowTransition';

export default function useMediaTransition<RefType extends HTMLElement = HTMLDivElement>(
  mediaData?: unknown,
  options?: Partial<HookParams<RefType>>,
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
