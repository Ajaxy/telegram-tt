import { useMemo, useRef, useState } from '../../../lib/teact/teact';

import type { WalletScreen } from './types';

import useLastCallback from '../../../hooks/useLastCallback';

// A stack rather than a parent mapping, since "back" leads where the screen came from; it also sets
// the slide direction, which `Transition` would otherwise derive from the numeric order of the keys
export default function useWalletNavigation(rootScreen: WalletScreen) {
  const [pushed, setPushed] = useState<WalletScreen[]>([]);

  // Set right before `setPushed` and read in the render it triggers, so a ref is enough
  const directionRef = useRef<1 | -1>(1);
  const isInstantRef = useRef(false);

  const push = useLastCallback((screen: WalletScreen, isInstant?: boolean) => {
    directionRef.current = 1;
    isInstantRef.current = Boolean(isInstant);

    // A second tap while the slide is still animating must not stack the same screen twice
    setPushed((current) => (current[current.length - 1] === screen ? current : [...current, screen]));
  });

  const replace = useLastCallback((screen: WalletScreen) => {
    directionRef.current = 1;
    isInstantRef.current = false;
    setPushed((current) => [...current.slice(0, -1), screen]);
  });

  const back = useLastCallback(() => {
    directionRef.current = -1;
    isInstantRef.current = false;
    setPushed((current) => current.slice(0, -1));
  });

  const reset = useLastCallback(() => {
    directionRef.current = -1;
    isInstantRef.current = false;
    setPushed([]);
  });

  const stack = useMemo(() => [rootScreen, ...pushed], [rootScreen, pushed]);

  return {
    stack,
    screen: stack[stack.length - 1],
    direction: directionRef.current,
    isInstant: isInstantRef.current,
    push,
    replace,
    back,
    reset,
  };
}
