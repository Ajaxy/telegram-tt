import { memo } from '@teact';

import styles from './TelebizError.module.scss';

const TelebizError = ({ error }: { error: string }) => {
  return (
    <div className={styles.container}>
      {error}
    </div>
  );
};

export default memo(TelebizError);
