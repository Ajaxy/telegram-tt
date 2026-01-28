import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ProviderEntity, ProviderEntityType } from '../../../services/types';

import { selectCurrentMessageList, selectTabState } from '../../../../global/selectors';
import {
  selectTelebizProperties,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import TelebizRelationshipModal from '.';

type StateProps = {
  isOpen: boolean;
  entity?: Partial<ProviderEntity>;
  type?: ProviderEntityType;
  isExisting?: boolean;
  properties: any[];
  selectedRelationship: any;
  provider: string;
};

const TelebizRelationshipModalContainer = ({
  isOpen,
  entity,
  type,
  isExisting,
  properties,
  selectedRelationship,
  provider,
}: StateProps) => {
  const {
    closeTelebizEntityModal,
    createTelebizAssociation,
    updateTelebizEntity,
  } = getActions();

  const handleClose = () => {
    closeTelebizEntityModal();
  };

  const handleSubmit = (formData: any) => {
    if (!type || !selectedRelationship) return;

    if (isExisting && entity) {
      // Update existing entity
      updateTelebizEntity({
        integrationId: selectedRelationship.integration_id,
        entityType: type,
        entityId: (entity as any).id,
        data: formData,
        parentEntity: {
          entityId: selectedRelationship.entity_id,
          entityType: selectedRelationship.entity_type,
        },
      });
    } else {
      // Create new entity
      createTelebizAssociation({
        data: {
          integrationId: selectedRelationship.integration_id,
          entityType: type,
          telegramId: '',
          parentEntityId: selectedRelationship.entity_id,
          parentEntityType: selectedRelationship.entity_type,
          ...formData,
        },
        parentEntity: {
          entityId: selectedRelationship.entity_id,
          entityType: selectedRelationship.entity_type,
        },
      });
    }

    closeTelebizEntityModal();
  };

  if (!isOpen || !type) return undefined;

  return (
    <TelebizRelationshipModal
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      entity={entity}
      creating={!isExisting}
      type={type}
      provider={provider}
      properties={properties}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId
      ? selectTelebizSelectedRelationship(global, chatId)
      : undefined;

    return {
      isOpen: tabState.relationshipModal?.isOpen || false,
      entity: tabState.relationshipModal?.entity,
      type: tabState.relationshipModal?.type,
      isExisting: tabState.relationshipModal?.isExisting,
      properties: selectedRelationship
        ? selectTelebizProperties(global, selectedRelationship.integration_id)
        : [],
      selectedRelationship,
      provider: selectedRelationship?.integration?.provider?.name || 'default',
    };
  },
)(TelebizRelationshipModalContainer));
