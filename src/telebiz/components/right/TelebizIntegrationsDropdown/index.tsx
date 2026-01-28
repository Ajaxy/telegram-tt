import type { FC } from '../../../../lib/teact/teact';
import { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { Integration } from '../../../services/types';

import { selectTelebizIntegrationsList } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';
import Spinner from '../../../../components/ui/Spinner';

import styles from './TelebizIntegrationsDropdown.module.scss';

interface OwnProps {
  selectedIntegrationId?: number;
  onSelectIntegration: (integrationId: number) => void;
}

type StateProps = {
  integrations: Integration[];
};

export const IntegrationItem: FC<{ integration?: Integration }> = ({ integration }) => (
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

const TelebizIntegrationsDropdown: FC<OwnProps & StateProps> = ({
  selectedIntegrationId,
  onSelectIntegration,
  integrations,
}) => {
  const selectedIntegration = integrations.find((it) => it.id === selectedIntegrationId);

  const IntegrationMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <div
        className={buildClassName(
          styles.integrationTrigger,
          isOpen && styles.integrationTriggerOpen,
        )}
        onClick={onTrigger}
      >
        <IntegrationItem integration={selectedIntegration} />
        <Icon name="down" />
      </div>
    );
  }, [selectedIntegration]);

  return (
    <DropdownMenu
      trigger={IntegrationMenuButton}
    >
      {integrations.map((integration: Integration) => (
        <MenuItem
          key={integration.id}
          onClick={() => onSelectIntegration(integration.id)}
        >
          <IntegrationItem integration={integration} />
        </MenuItem>
      ))}
    </DropdownMenu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    integrations: selectTelebizIntegrationsList(global),
  }),
)(TelebizIntegrationsDropdown));
