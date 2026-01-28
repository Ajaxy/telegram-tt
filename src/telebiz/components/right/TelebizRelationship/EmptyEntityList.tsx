import { memo } from '@teact';

import { PROVIDER_ENTITY_TYPE_TO_PLURAL_MAP, type ProviderEntityType } from '../../../services';

import styles from './TelebizRelationship.module.scss';

interface EmptyEntityListProps {
  entityType: ProviderEntityType;
}

const EmptyEntityList = ({ entityType }: EmptyEntityListProps) => {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.emptyEntityList}>
        <h3>
          No
          {' '}
          {PROVIDER_ENTITY_TYPE_TO_PLURAL_MAP[entityType]}
          {' '}
          yet
        </h3>
      </div>
    </div>
  );
};

export default memo(EmptyEntityList);
