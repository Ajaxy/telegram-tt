import { memo, useCallback, useMemo } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type {
  Integration,
  PropertiesByEntityType,
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderEntity,
  ProviderPage,
  ProviderRelationship,
} from '../../../../services/types';
import { ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizEntityLoadingState,
  selectTelebizProperties,
  selectTelebizRelationshipsByEntity,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import { selectTelebizUser } from '../../../../global/selectors/auth';
import buildClassName from '../../../../../util/buildClassName';
import { getDealColorByProbability, getEntityTitle } from '../../../../util/general';
import { getNotionPageStatusObject } from '../../../../util/notion';

import PeerChip from '../../../../../components/common/PeerChip';
import DropdownMenu from '../../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../../components/ui/MenuItem';
import CompanyHeaderData from './CompanyHeaderData';
import ContactHeaderData from './ContactHeaderData';
import DealHeaderData from './DealHeaderData';
import PageHeaderData from './PageHeaderData';

import styles from './Header.module.scss';

interface OwnProps {
  entity: ProviderEntity;
  entityType: ProviderEntityType;
  integrationId?: number;
  integration?: Integration;
  isMobile?: boolean;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedRelationship?: ProviderRelationship;
  loadingState?: { entityId?: string; loadingType?: string };
  entityProperties: PropertiesByEntityType[];
  currentUserId?: number;
  relationshipUserId?: number;
};

const RelationshipHeader = ({
  entity,
  entityType,
  isMobile,
  integrationId,
  integration,
  relationshipsList,
  selectedRelationship,
  loadingState,
  entityProperties,
  currentUserId,
  relationshipUserId,
}: OwnProps & StateProps) => {
  const { openChat, openTelebizEntityModal, openTelebizRemoveEntityFromChatDialog } = getActions();

  const relationships = useMemo(() => {
    return relationshipsList.filter(
      (x: ProviderRelationship) =>
        String(x.entity_id) === String(entity.id)
        && x.entity_type === entityType
        && x.integration_id === selectedRelationship?.integration_id
        && x.telegram_id !== selectedRelationship?.telegram_id,
    );
  }, [
    relationshipsList,
    entity.id,
    entityType,
    selectedRelationship?.integration_id,
    selectedRelationship?.telegram_id,
  ]);

  const stageClassName = useMemo(() => {
    if (entityType === ProviderEntityType.Deal) {
      return getDealColorByProbability((entity as ProviderDeal).probability || 0);
    }
    if (entityType === ProviderEntityType.Page) {
      return getNotionPageStatusObject(entity as ProviderPage)?.color || 'white';
    }
    return 'default';
  }, [entityType, entity]);

  const handleEditRelationship = useCallback(() => {
    openTelebizEntityModal({
      type: entityType,
      entity,
      isExisting: true,
    });
  }, [openTelebizEntityModal, entity, entityType]);

  const handleDeleteRelationship = useCallback(() => {
    const title = getEntityTitle(entity, entityType);
    openTelebizRemoveEntityFromChatDialog({ title });
  }, [openTelebizRemoveEntityFromChatDialog, entity, entityType]);

  const canDelete = currentUserId === relationshipUserId;

  const properties = useMemo(() => {
    return entityProperties.find((p) => p.id as ProviderEntityType === entityType)?.properties || [];
  }, [entityProperties, entityType]);

  const getEntityData = useCallback(() => {
    switch (entityType) {
      case ProviderEntityType.Contact:
        return (
          <ContactHeaderData
            contact={entity as ProviderContact}
            properties={properties}
            integration={integration}
          />
        );
      case ProviderEntityType.Deal:
        return (
          <DealHeaderData
            deal={entity as ProviderDeal}
            integrationId={integrationId}
            stageClassName={stageClassName}
            properties={properties}
            integration={integration}
          />
        );
      case ProviderEntityType.Company:
        return (
          <CompanyHeaderData
            company={entity as ProviderCompany}
            properties={properties}
            integration={integration}
          />
        );
      case ProviderEntityType.Page:
        return (
          <PageHeaderData page={entity as ProviderPage} properties={entityProperties} />
        );
      default:
        return undefined;
    }
  }, [entity, entityType, integrationId, stageClassName, entityProperties, properties, integration]);

  const isLoading = loadingState && (loadingState.entityId === entity.id || !loadingState.entityId);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={buildClassName(
          styles.stageBorder,
          styles[stageClassName],
          styles[entityType],
          styles[entityType === ProviderEntityType.Page ? 'page' : ''],
          isLoading && styles.loading)}
        >
        </div>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            {getEntityTitle(entity, entityType)}
          </div>
          <DropdownMenu
            className={styles.dropdownMenu}
            positionX="right"
          >
            <MenuItem
              icon="edit"
              onClick={handleEditRelationship}
            >
              Edit
            </MenuItem>
            <MenuItem
              icon="delete"
              destructive
              disabled={!canDelete}
              onClick={handleDeleteRelationship}
            >
              Delete
            </MenuItem>
          </DropdownMenu>
        </div>
        {getEntityData()}
        {
          relationships.length > 0 && (
            relationships.map((x: ProviderRelationship) => (
              <PeerChip
                key={x.id}
                peerId={x.telegram_id}
                onClick={() => {
                  openChat({ id: x.telegram_id, shouldReplaceHistory: true });
                }}
                className={styles.chatChip}
              />
            ))
          )
        }
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};

    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;
    const currentUser = selectTelebizUser(global);

    return {
      relationshipsList: selectTelebizRelationshipsByEntity(
        global,
        selectedRelationship?.entity_id || '',
        selectedRelationship?.entity_type || ProviderEntityType.Contact,
        selectedRelationship?.integration_id || 0,
      ) || [],
      selectedRelationship,
      loadingState: selectTelebizEntityLoadingState(global),
      entityProperties: selectedRelationship ?
        selectTelebizProperties(global, selectedRelationship.integration_id) : [],
      currentUserId: currentUser?.id,
      relationshipUserId: selectedRelationship?.user_id,
    };
  },
)(RelationshipHeader));
