import { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';

import useLastCallback from '../../hooks/useLastCallback';

import Icon from './icons/Icon';

import styles from './CollapsibleSection.module.scss';

type OwnProps = {
  title: string;
  isCollapsed: boolean;
  className?: string;
  children: React.ReactNode;
  onToggle: NoneToVoidFunction;
};

const TRANSITION_DURATION = 250;
const CLEANUP_FALLBACK_MS = TRANSITION_DURATION + 100;

const CollapsibleSection = ({
  title,
  isCollapsed,
  className,
  children,
  onToggle,
}: OwnProps) => {
  const contentRef = useRef<HTMLDivElement>();
  const isFirstRunRef = useRef(true);
  const cancelCleanupRef = useRef<NoneToVoidFunction>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    cancelCleanupRef.current?.();
    cancelCleanupRef.current = undefined;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      if (isCollapsed) {
        requestMutation(() => {
          content.style.height = '0px';
        });
      }
      return;
    }

    if (isCollapsed) {
      requestForcedReflow(() => {
        const height = content.scrollHeight;

        return () => {
          content.style.height = `${height}px`;

          requestForcedReflow(() => {
            void content.offsetHeight;

            return () => {
              content.style.height = '0px';
            };
          });
        };
      });
    } else {
      requestForcedReflow(() => {
        const height = content.scrollHeight;

        return () => {
          content.style.height = `${height}px`;

          cancelCleanupRef.current = waitForTransitionEnd(content, () => {
            requestMutation(() => {
              content.style.height = '';
            });
          }, 'height', CLEANUP_FALLBACK_MS);
        };
      });
    }
  }, [isCollapsed]);

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  });

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        className={styles.header}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <p className={styles.title}>{title}</p>
        <Icon
          name="up"
          className={buildClassName(styles.chevron, isCollapsed && styles.chevronCollapsed)}
        />
      </div>
      <div
        ref={contentRef}
        aria-hidden={isCollapsed}
        className={buildClassName(styles.content, isCollapsed && styles.contentCollapsed)}
      >
        {children}
      </div>
    </div>
  );
};

export default memo(CollapsibleSection);
