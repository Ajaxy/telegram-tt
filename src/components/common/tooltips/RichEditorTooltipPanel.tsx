import type { TeactNode } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './RichEditorTooltipContainer.module.scss';

type OwnProps = {
  isOpen: boolean;
  children: TeactNode;
};

const RichEditorTooltipPanel = ({ isOpen, children }: OwnProps) => {
  return (
    <div className={buildClassName(styles.fade, isOpen && styles.open)}>
      {children}
    </div>
  );
};

export default RichEditorTooltipPanel;
