import type { Integration } from '../../../services';

import Spinner from '../../../../components/ui/Spinner';

import styles from './TelebizAddRelationship.module.scss';

export const IntegrationItem = ({ integration }: { integration?: Integration }) => (
  <div className={styles.integrationItem}>
    <div className={styles.integrationItemIcon}>
      {integration?.provider.icon_url ? (
        <img src={integration?.provider.icon_url} alt={integration?.provider.display_name} />
      ) : (
        <Spinner />
      )}
    </div>
    <div className={styles.integrationItemInfo}>
      <span className={styles.integrationItemName}>{integration?.provider.display_name}</span>
      <span className={styles.integrationItemSubtitle}>{integration?.provider_account_name}</span>
    </div>
  </div>
);
