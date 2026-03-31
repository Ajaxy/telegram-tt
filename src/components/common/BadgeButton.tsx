import { type TeactNode } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './BadgeButton.module.scss';

type OwnProps = {
  children: TeactNode;
  className?: string;
  isPlain?: boolean;
  inline?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const BadgeButton = ({
  children,
  className,
  isPlain,
  inline,
  onClick,
  onMouseDown,
}: OwnProps) => {
  return (
    <div
      className={buildClassName(
        styles.root,
        isPlain && styles.plain,
        onClick && styles.clickable,
        inline && styles.inline,
        className,
      )}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
};

export default BadgeButton;
