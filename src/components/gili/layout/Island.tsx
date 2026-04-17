import buildClassName from '../../../util/buildClassName';

import styles from './Island.module.scss';

type OwnProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

const Island = ({ className, children, ...otherProps }: OwnProps) => {
  return (
    <div
      className={buildClassName(styles.island, className)}
      {...otherProps}
    >
      {children}
    </div>
  );
};

const IslandDescription = ({ className, children, ...otherProps }: OwnProps) => {
  return (
    <div
      className={buildClassName(styles.description, className)}
      {...otherProps}
    >
      {children}
    </div>
  );
};

const IslandText = ({ className, children, ...otherProps }: OwnProps) => {
  return (
    <div
      className={buildClassName(styles.text, className)}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export default Island;
export {
  IslandDescription,
  IslandText,
};
