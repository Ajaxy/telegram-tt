import buildClassName from '../../../../util/buildClassName';

import styles from './TelebizPlaceholder.module.scss';

interface OwnProps {
  className?: string;
}

const TelebizPlaceholder = ({ className }: OwnProps) => {
  return (
    <div className={buildClassName(styles.shimmer, className)} />
  );
};

export default TelebizPlaceholder;
