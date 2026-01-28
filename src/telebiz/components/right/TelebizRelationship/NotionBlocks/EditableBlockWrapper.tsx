import { memo, useCallback, useEffect, useRef, useState } from '@teact';

import buildClassName from '../../../../../util/buildClassName';

import Icon from '../../../../../components/common/icons/Icon';
import { useEditingContext } from './EditingContext';

import styles from './NotionBlocks.module.scss';

interface Props {
  blockId: string;
  children: (params: {
    isEditing: boolean;
    editedValue: string;
    setEditedValue: (value: string) => void;
    handleSave: () => void;
  }) => React.ReactNode;
  originalValue: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
}

const EditableBlockWrapper = memo(({
  blockId,
  children,
  originalValue,
  onSave,
  className,
}: Props) => {
  const { editingBlockId, setEditingBlockId } = useEditingContext();
  const [editedValue, setEditedValue] = useState(originalValue);
  const [isSaving, setIsSaving] = useState(false);
  const blockRef = useRef<HTMLDivElement>();

  const isEditing = editingBlockId === blockId;

  useEffect(() => {
    setEditedValue(originalValue);
  }, [originalValue]);

  const handleEdit = useCallback(() => {
    setEditedValue(originalValue);
    setEditingBlockId(blockId);
  }, [originalValue, blockId, setEditingBlockId]);

  const handleSave = useCallback(async () => {
    if (editedValue !== originalValue) {
      setIsSaving(true);
      await onSave(editedValue);
      setIsSaving(false);
    }
    setEditingBlockId(undefined);
  }, [editedValue, originalValue, onSave, setEditingBlockId]);

  const handleCancel = useCallback(() => {
    setEditedValue(originalValue);
    setEditingBlockId(undefined);
  }, [originalValue, setEditingBlockId]);

  // Click outside to cancel
  useEffect(() => {
    if (!isEditing) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (blockRef.current && !blockRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, handleCancel]);

  return (
    <div ref={blockRef} className={buildClassName(styles.block, className)}>
      {children({ isEditing, editedValue, setEditedValue, handleSave })}

      {isEditing ? (
        <div className={styles.editControls}>
          <button
            type="button"
            className={buildClassName(styles.controlButton, styles.saveButton)}
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Save changes"
          >
            <Icon name="check" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.editButton}
          onClick={handleEdit}
          aria-label="Edit block"
        >
          <Icon name="edit" />
        </button>
      )}
    </div>
  );
});

export default EditableBlockWrapper;
