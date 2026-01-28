import { memo } from '@teact';

import type { ProviderEntity, ProviderEntityType } from '../../../../services/types';

import { getEntityTitle } from '../../../../util/general';

import styles from './RelationshipLinkView.module.scss';

interface OwnProps {
  entity: ProviderEntity;
  entityType: ProviderEntityType;
}

const ParentEntityDetails = ({
  entity,
  entityType,
}: OwnProps) => {
  return (
    <div>
      <h1 className={styles.title}>{getEntityTitle(entity, entityType)}</h1>
    </div>
  );
};

export default memo(ParentEntityDetails);
