import React, {
  type TeactNode,
  useRef,
} from '../../lib/teact/teact';

import { ApiMessageEntityTypes } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import useCollapsibleLines from '../../hooks/element/useCollapsibleLines';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from './icons/Icon';

import styles from './Blockquote.module.scss';

type OwnProps = {
  canBeCollapsible?: boolean;
  isToggleDisabled?: boolean;
  children: TeactNode;
};

const MAX_LINES = 4;

const Blockquote = ({ canBeCollapsible, isToggleDisabled, children }: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLQuoteElement>(null);
  const {
    isCollapsed, isCollapsible, setIsCollapsed,
  } = useCollapsibleLines(ref, MAX_LINES, undefined, !canBeCollapsible);

  const canExpand = !isToggleDisabled && isCollapsed;

  const handleExpand = useLastCallback(() => {
    setIsCollapsed(false);
  });

  const handleToggle = useLastCallback(() => {
    setIsCollapsed((prev) => !prev);
  });

  return (
    <span
      className={buildClassName(styles.root, isCollapsed && styles.collapsed)}
      onClick={canExpand ? handleExpand : undefined}
    >
      <blockquote
        className={styles.blockquote}
        ref={ref}
        data-entity-type={ApiMessageEntityTypes.Blockquote}
      >
        <div className={styles.gradientContainer}>
          {children}
        </div>
        {isCollapsible && (
          <div
            className={buildClassName(styles.collapseIcon, !isToggleDisabled && styles.clickable)}
            onClick={!isToggleDisabled ? handleToggle : undefined}
            aria-hidden
          >
            <Icon name={isCollapsed ? 'down' : 'up'} />
          </div>
        )}
      </blockquote>
    </span>
  );
};

export default Blockquote;
