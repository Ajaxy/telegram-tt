import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { Integration, Organization } from '../../../services/types';

import {
  selectCurrentTelebizOrganization,
  selectIsTelebizAuthenticated,
  selectTelebizIntegrationsIsLoading,
  selectTelebizIntegrationsList,
  selectTelebizOrganizationsIsLoading,
} from '../../../global/selectors';

import Loading from '../../../../components/ui/Loading';
import LogoE from '../../icons/LogoE';

import styles from './TelebizCTA.module.scss';

type OwnProps = {
  className?: string;
};

type StateProps = {
  isAuthenticated: boolean;
  currentOrganization?: Organization;
  isLoadingOrganization: boolean;
  integrations: Integration[];
  isLoadingIntegrations: boolean;
};

const TelebizCTA: FC<OwnProps & StateProps> = ({
  className,
  isAuthenticated,
  currentOrganization,
  isLoadingOrganization,
  integrations,
  isLoadingIntegrations,
}) => {
  const showNotification = (!currentOrganization && !isLoadingOrganization)
    || (integrations.length === 0 && !isLoadingIntegrations);

  if (!isAuthenticated) {
    return <Loading color="white" className={styles.loading} />;
  }

  return (
    <div className={styles.container}>
      <LogoE className={className} />
      {showNotification && (
        <div className={styles.notification} />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    isAuthenticated: selectIsTelebizAuthenticated(global),
    currentOrganization: selectCurrentTelebizOrganization(global),
    isLoadingOrganization: selectTelebizOrganizationsIsLoading(global),
    integrations: selectTelebizIntegrationsList(global),
    isLoadingIntegrations: selectTelebizIntegrationsIsLoading(global),
  }),
)(TelebizCTA));
