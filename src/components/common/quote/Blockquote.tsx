import {
  type TeactNode,
  useRef,
} from '../../../lib/teact/teact';

import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useCollapsibleLines from '../../../hooks/element/useCollapsibleLines';
import { useSharedCanvas } from '../../../hooks/useCoordsInSharedCanvas';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../icons/Icon';
import SharedCanvas from '../SharedCanvas';

import styles from './Blockquote.module.scss';

type OwnProps = {
  className?: string;
  contentClassName?: string;
  richQuoteIndex?: number;
  canBeCollapsible?: boolean;
  isToggleDisabled?: boolean;
  noInitialCollapse?: boolean;
  shouldExpand?: boolean;
  recalculationKey?: unknown;
  ignoredLines?: number;
  isCollapsed?: boolean;
  hasCanvasContent?: boolean;
  contentKey?: unknown;
  children: TeactNode;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const MAX_LINES = 4;

const Blockquote = ({
  className,
  contentClassName,
  richQuoteIndex,
  canBeCollapsible,
  isToggleDisabled,
  noInitialCollapse,
  shouldExpand,
  recalculationKey,
  ignoredLines,
  isCollapsed: isCollapsedControlled,
  hasCanvasContent,
  contentKey,
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
    ignoredLines,
    isCollapsed: shouldExpand ? false : isCollapsedControlled,
    onCollapseChange,
  });

  const shouldCollapse = Boolean(canBeCollapsible && isCollapsed);
  const hasCollapseIcon = canBeCollapsible && isCollapsible;
  const canExpand = !isToggleDisabled && shouldCollapse;
  const sharedCanvas = useSharedCanvas();
  const withNestedCanvas = hasCanvasContent && canBeCollapsible && sharedCanvas;

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
        data-rich-quote-index={richQuoteIndex}
        className={buildClassName(styles.blockquote, contentClassName, hasCollapseIcon && styles.withCollapseIcon)}
        ref={ref}
        data-entity-type={ApiMessageEntityTypes.Blockquote}
        data-collapsed={shouldCollapse || undefined}
        contentEditable={shouldCollapse ? false : undefined}
      >
        <div
          className={buildClassName(styles.gradientContainer, withNestedCanvas && 'shared-canvas-container')}
          data-rich-copy-wrapper
        >
          {withNestedCanvas ? (
            <SharedCanvas isGpu={sharedCanvas.isGpu} contentKey={contentKey}>{children}</SharedCanvas>
          ) : children}
        </div>
        {hasCollapseIcon && (
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
