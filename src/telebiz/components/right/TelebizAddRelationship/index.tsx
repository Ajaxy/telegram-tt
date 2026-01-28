import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Integration, Organization } from '../../../services/types';
import { type ProviderEntity, ProviderEntityType } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import {
  selectCurrentTelebizOrganization,
  selectTelebizAuthIsLoading,
  selectTelebizIntegrationsList,
  selectTelebizOrganizationsIsLoading,
  selectTelebizSelectedIntegrationId,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import Button from '../../../../components/ui/Button';
import Loading from '../../../../components/ui/Loading';
import TelebizIntegrationsDropdown from '../TelebizIntegrationsDropdown';
import CompleteSteps from './CompleteSteps';
import SearchProviderEntities from './SearchProviderEntities';

import styles from './TelebizAddRelationship.module.scss';

interface OwnProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSelectedEntity: (entity: ProviderEntity, entityType: ProviderEntityType) => void;
  selectedEntityType: ProviderEntityType;
  setSelectedEntityType: (entityType: ProviderEntityType) => void;
}

type StateProps = {
  isLoadingAuth: boolean;
  integrations: Integration[];
  currentOrganization?: Organization;
  isOrganizationLoading: boolean;
  selectedIntegrationId?: number;
};

const TelebizAddRelationship: FC<OwnProps & StateProps> = ({
  searchQuery,
  setSearchQuery,
  setSelectedEntity,
  selectedEntityType,
  setSelectedEntityType,
  isLoadingAuth,
  integrations,
  currentOrganization,
  isOrganizationLoading,
  selectedIntegrationId,
}) => {
  const {
    openTelebizPanelScreen,
    setTelebizSelectedIntegrationId,
    loadTelebizProviderProperties,
  } = getActions();

  const entityTypes = useMemo(() => {
    return integrations.find((i) => i.id === selectedIntegrationId)?.provider.entity_details.map((e) => e.type) || [];
  }, [integrations, selectedIntegrationId]);

  useEffect(() => {
    if (!entityTypes.length) return;
    if (!entityTypes.includes(selectedEntityType)) {
      setSelectedEntityType(entityTypes[0]);
    }
  }, [entityTypes, selectedEntityType, setSelectedEntityType]);

  // Auto-select first integration if none selected
  useEffect(() => {
    if (!selectedIntegrationId && integrations.length > 0) {
      setTelebizSelectedIntegrationId({ integrationId: integrations[0].id });
    }
  }, [selectedIntegrationId, integrations, setTelebizSelectedIntegrationId]);

  // Load pipelines and properties for the selected integration
  useEffect(() => {
    if (selectedIntegrationId) {
      loadTelebizProviderProperties({ integrationId: selectedIntegrationId });
    }
  }, [selectedIntegrationId, loadTelebizProviderProperties]);

  const hasStepsToComplete = !currentOrganization || !integrations.length;

  if (isOrganizationLoading || isLoadingAuth) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Loading />
        </div>
      </div>
    );
  }

  const onCreateEntity = useCallback(() => {
    switch (selectedEntityType) {
      case ProviderEntityType.Contact:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreateContact });
        break;
      case ProviderEntityType.Deal:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreateDeal });
        break;
      case ProviderEntityType.Company:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreateCompany });
        break;
      case ProviderEntityType.Page:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreatePage });
        break;
      default:
        break;
    }
  }, [openTelebizPanelScreen, selectedEntityType]);

  const handleSelectIntegration = useCallback((integrationId: number) => {
    setTelebizSelectedIntegrationId({ integrationId });
  }, [setTelebizSelectedIntegrationId]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {hasStepsToComplete ? (
          <CompleteSteps selectedIntegrationId={selectedIntegrationId} />
        ) : (
          <>
            <TelebizIntegrationsDropdown
              selectedIntegrationId={selectedIntegrationId}
              onSelectIntegration={handleSelectIntegration}
            />
            <div className={styles.entityTypeSelection}>
              {entityTypes.map((_entityType) => (
                <div key={_entityType} className={styles.entityType}>
                  <Button
                    size="tiny"
                    color="translucent"
                    pill
                    fluid
                    onClick={() => setSelectedEntityType(_entityType)}
                    className={buildClassName(
                      styles.entityTypeButton,
                      'active',
                      selectedEntityType === _entityType && 'activated',
                    )}
                  >
                    {_entityType}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
        <SearchProviderEntities
          entityType={selectedEntityType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          disabled={hasStepsToComplete}
          setSelectedEntity={setSelectedEntity}
          onCreateEntity={onCreateEntity}
          integrationId={selectedIntegrationId}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    isLoadingAuth: selectTelebizAuthIsLoading(global),
    integrations: selectTelebizIntegrationsList(global),
    currentOrganization: selectCurrentTelebizOrganization(global),
    isOrganizationLoading: selectTelebizOrganizationsIsLoading(global),
    selectedIntegrationId: selectTelebizSelectedIntegrationId(global),
  }),
)(TelebizAddRelationship));
