import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ProviderEntityType } from '../../../services/types';
import { ASSOCIATED_ENTITY_TYPES } from '../../../services/types';

import { selectCurrentMessageList, selectTabState } from '../../../../global/selectors';
import { selectTelebizSelectedRelationship } from '../../../global/selectors';
import ConfirmRelationshipEntityDeleteDialog from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

type StateProps = {
  isOpen: boolean;
  entityId?: string;
  entityType?: ProviderEntityType;
  integrationId?: number;
  parentEntityId?: string;
  parentEntityType?: ProviderEntityType;
};

const ConfirmDeleteDialogContainer = ({
  isOpen,
  entityId,
  entityType,
  integrationId,
  parentEntityId,
  parentEntityType,
}: StateProps) => {
  const {
    closeTelebizConfirmDeleteDialog,
    deleteTelebizEntity,
    removeEntityAssociation,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeTelebizConfirmDeleteDialog();
  });

  const handleConfirmDelete = useLastCallback(() => {
    if (!entityId || !entityType || !integrationId || !parentEntityId || !parentEntityType) return;

    // For associated entity types (Deal, Contact, Page), remove the association
    // For sub-entities (Note, Task, Meeting), delete the entity
    if (ASSOCIATED_ENTITY_TYPES.includes(entityType)) {
      removeEntityAssociation({
        integrationId,
        entityType,
        entityId,
        associatedEntityType: parentEntityType,
        associatedEntityId: parentEntityId,
      });
    } else {
      deleteTelebizEntity({
        integrationId,
        entityType,
        entityId,
        parentEntity: {
          entityId: parentEntityId,
          entityType: parentEntityType,
        },
      });
    }

    closeTelebizConfirmDeleteDialog();
  });

  if (!isOpen || !entityType) return undefined;

  return (
    <ConfirmRelationshipEntityDeleteDialog
      isOpen={isOpen}
      entityType={entityType}
      handleClose={handleClose}
      handleConfirmDelete={handleConfirmDelete}
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

    const dialog = tabState.deleteEntityDialog;

    return {
      isOpen: dialog?.isOpen || false,
      entityId: dialog?.entityId,
      entityType: dialog?.entityType,
      integrationId: selectedRelationship?.integration_id,
      parentEntityId: selectedRelationship?.entity_id,
      parentEntityType: selectedRelationship?.entity_type,
    };
  },
)(ConfirmDeleteDialogContainer));
