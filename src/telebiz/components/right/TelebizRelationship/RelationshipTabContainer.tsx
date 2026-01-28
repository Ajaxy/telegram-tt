import { memo } from '@teact';

import buildClassName from '../../../../util/buildClassName';

import styles from './TelebizRelationship.module.scss';

interface OwnProps {
  children: React.ReactNode;
}
const RelationshipTabContainer = ({
  children,
}: OwnProps) => {
  return (
    <div className={styles.tabContainerWrapper}>
      <div className={buildClassName('no-scrollbar', styles.tabContainer)}>
        {children}
      </div>
    </div>
  );
};

export default memo(RelationshipTabContainer);
