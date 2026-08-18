import {
  type TeactNode,
  useRef,
} from '../../../lib/teact/teact';

import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useCollapsibleLines from '../../../hooks/element/useCollapsibleLines';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../icons/Icon';

import styles from './Blockquote.module.scss';

type OwnProps = {
  className?: string;
  contentClassName?: string;
  canBeCollapsible?: boolean;
  isToggleDisabled?: boolean;
  noInitialCollapse?: boolean;
  recalculationKey?: unknown;
  isCollapsed?: boolean;
  children: TeactNode;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const MAX_LINES = 4;

const Blockquote = ({
  className,
  contentClassName,
  canBeCollapsible,
  isToggleDisabled,
  noInitialCollapse,
  recalculationKey,
  isCollapsed: isCollapsedControlled,
  children,
  onCollapseChange,
}: OwnProps) => {
  const ref = useRef<HTMLQuoteElement>();
  const {
    isCollapsed, isCollapsible, setIsCollapsed,
  } = useCollapsibleLines(ref, MAX_LINES, {
    isDisabled: !canBeCollapsible,
    noInitialCollapse,
    recalculationKey,
    isCollapsed: isCollapsedControlled,
    onCollapseChange,
  });

  const shouldCollapse = Boolean(canBeCollapsible && isCollapsed);
  const canExpand = !isToggleDisabled && shouldCollapse;

  const handleExpand = useLastCallback(() => {
    setIsCollapsed(false);
  });

  const handleToggle = useLastCallback(() => {
    setIsCollapsed((prev) => !prev);
  });

  return (
    <span
      className={buildClassName(styles.root, className, shouldCollapse && styles.collapsed)}
      onClick={canExpand ? handleExpand : undefined}
    >
      <blockquote
        className={buildClassName(styles.blockquote, contentClassName)}
        ref={ref}
        data-entity-type={ApiMessageEntityTypes.Blockquote}
        contentEditable={shouldCollapse ? false : undefined}
      >
        <div className={styles.gradientContainer} data-rich-copy-wrapper>
          {children}
        </div>
        {canBeCollapsible && isCollapsible && (
          <div
            className={buildClassName(styles.collapseIcon, !isToggleDisabled && styles.clickable)}
            contentEditable={false}
            onClick={!isToggleDisabled ? handleToggle : undefined}
            aria-hidden
          >
            <Icon name={shouldCollapse ? 'down' : 'up'} />
          </div>
        )}
      </blockquote>
    </span>
  );
};

export default Blockquote;
