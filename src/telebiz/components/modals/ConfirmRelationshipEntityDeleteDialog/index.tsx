import { memo } from '@teact';

import type { ProviderEntityType } from '../../../services/types';
import { ASSOCIATED_ENTITY_TYPES } from '../../../services/types';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

interface ConfirmRelationshipEntityDeleteDialogProps {
  isOpen: boolean;
  handleClose: () => void;
  handleConfirmDelete: () => void;
  entityType: ProviderEntityType;
}

const ConfirmRelationshipEntityDeleteDialog = ({
  isOpen,
  handleClose,
  entityType,
  handleConfirmDelete,
}: ConfirmRelationshipEntityDeleteDialogProps) => {
  const lang = useTelebizLang();

  let title = lang('DeleteRelationshipItemConfirmationModal.Title',
    {
      entity: entityType, action: ASSOCIATED_ENTITY_TYPES.includes(entityType) ?
        lang('DeleteRelationshipItemConfirmationModal.Remove') :
        lang('DeleteRelationshipItemConfirmationModal.Delete'),
    });

  title = title.charAt(0).toUpperCase() + title.slice(1);

  const text = lang('DeleteRelationshipItemConfirmationModal.Description',
    {
      entity: entityType, action: ASSOCIATED_ENTITY_TYPES.includes(entityType) ?
        lang('DeleteRelationshipItemConfirmationModal.Remove') :
        lang('DeleteRelationshipItemConfirmationModal.Delete'),
    });

  const confirmLabel = lang('DeleteRelationshipItemConfirmationModal.Remove');

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      text={text}
      confirmLabel={confirmLabel}
      confirmHandler={handleConfirmDelete}
      confirmIsDestructive
    />
  );
};

export default memo(ConfirmRelationshipEntityDeleteDialog);
