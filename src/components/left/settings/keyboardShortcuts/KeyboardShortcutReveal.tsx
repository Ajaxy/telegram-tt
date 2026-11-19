import type { TeactNode } from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useShowTransition from '../../../../hooks/useShowTransition';

import styles from './SettingsKeyboardShortcuts.module.scss';

type OwnProps = {
  isOpen: boolean;
  className?: string;
  children: TeactNode;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const KeyboardShortcutReveal = ({
  isOpen,
  className,
  children,
  onCloseAnimationEnd,
}: OwnProps) => {
  const { ref, shouldRender } = useShowTransition({
    isOpen,
    noMountTransition: true,
    withShouldRender: true,
    className: false,
    onCloseAnimationEnd,
  });
  const content = useCurrentOrPrev(isOpen ? children : undefined, true);

  if (!shouldRender) return undefined;

  return (
    <div ref={ref} className={buildClassName(styles.reveal, className)}>
      <div className={styles.revealClip}>{content}</div>
    </div>
  );
};

export default KeyboardShortcutReveal;
