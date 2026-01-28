import { memo, useCallback, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ProviderCompany,
  ProviderDeal, ProviderEntity, ProviderPage, ProviderRelationship } from '../../../services';
import { TelebizPanelScreens } from '../types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import { selectTelebizEntity, selectTelebizSelectedRelationship } from '../../../global/selectors';
import { PROVIDER_ENTITY_TYPE_TO_PLURAL_MAP, type ProviderContact, ProviderEntityType } from '../../../services';

import SearchProviderEntities from '../TelebizAddRelationship/SearchProviderEntities';

import styles from '../TelebizAddRelationship/TelebizAddRelationship.module.scss';

interface OwnProps {
  onEntitySelected: (entity: ProviderContact | ProviderDeal | ProviderCompany | ProviderPage) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  entityType: ProviderEntityType;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  selectedEntity?: ProviderEntity;
};

const TelebizAssociateEntities = ({
  onEntitySelected,
  searchQuery,
  setSearchQuery,
  entityType,
  selectedRelationship,
  selectedEntity,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen } = getActions();

  const associatedContactIds = useMemo(() => {
    const pluralEntityType = PROVIDER_ENTITY_TYPE_TO_PLURAL_MAP[entityType];
    if (!selectedRelationship || !selectedEntity) return [];

    if (!selectedEntity?.associations?.[pluralEntityType as keyof typeof selectedEntity.associations]) return [];

    return (
      selectedEntity.associations[pluralEntityType as keyof typeof selectedEntity.associations] as ProviderEntity[]
    ).map((e) => e.id).filter(Boolean);
  }, [selectedEntity, selectedRelationship, entityType]);

  const onCreateEntity = useCallback(() => {
    switch (entityType) {
      case ProviderEntityType.Contact:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreateAndAddContactToEntity });
        break;
      case ProviderEntityType.Company:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.CreateAndAddCompanyToEntity });
        break;
      default:
        break;
    }
  }, [openTelebizPanelScreen, entityType]);

  const onSelectEntity = (entity: ProviderContact | ProviderDeal | ProviderPage | ProviderCompany) => {
    onEntitySelected(entity);
    switch (entityType) {
      case ProviderEntityType.Contact:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.AddExistingContactToEntity });
        break;
      case ProviderEntityType.Company:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.AddExistingCompanyToEntity });
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <SearchProviderEntities
          entityType={entityType}
          integrationId={selectedRelationship?.integration_id}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setSelectedEntity={onSelectEntity}
          onCreateEntity={onCreateEntity}
          excludedIds={associatedContactIds}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    let selectedEntity: ProviderEntity | undefined;
    if (selectedRelationship) {
      selectedEntity = selectTelebizEntity(
        global,
        selectedRelationship.integration_id,
        selectedRelationship.entity_type,
        selectedRelationship.entity_id,
      );
    }

    return {
      selectedRelationship,
      selectedEntity,
    };
  },
)(TelebizAssociateEntities));
