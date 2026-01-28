import { memo, useCallback, useEffect, useRef } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import type { NotionBlock } from '../../../../services/types';

import buildClassName from '../../../../../util/buildClassName';
import { formatBlockForUpdate, getBlockText } from '../../../../util/notion';

import Checkbox from '../../../../../components/ui/Checkbox';
import EditableBlockWrapper from './EditableBlockWrapper';

import styles from './NotionBlocks.module.scss';

interface Props {
  block: NotionBlock;
  integrationId: number;
  pageId: string;
}

const NotionToDo = memo(({ block, integrationId, pageId }: Props) => {
  const { updateTelebizNotionBlock } = getActions();
  const inputRef = useRef<HTMLInputElement>();

  const blockData = block[block.type];
  const originalText = blockData?.rich_text ? getBlockText(blockData.rich_text) : '';
  const isChecked = blockData?.checked || false;

  const handleCheckboxToggle = useCallback(async () => {
    updateTelebizNotionBlock({
      integrationId,
      pageId,
      blockId: block.id,
      blockData: formatBlockForUpdate(block.type, originalText, { checked: !isChecked }),
    });
  }, [updateTelebizNotionBlock, integrationId, pageId, block.id, block.type, originalText, isChecked]);

  const handleTextSave = useCallback(async (newText: string) => {
    updateTelebizNotionBlock({
      integrationId,
      pageId,
      blockId: block.id,
      blockData: formatBlockForUpdate(block.type, newText, { checked: isChecked }),
    });
  }, [updateTelebizNotionBlock, integrationId, pageId, block.id, block.type, isChecked]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCallback();
    }
  }, []);

  return (
    <EditableBlockWrapper
      blockId={block.id}
      originalValue={originalText}
      onSave={handleTextSave}
      className={styles.todoBlock}
    >
      {({ isEditing, editedValue, setEditedValue, handleSave: saveCallback }) => {
        useEffect(() => {
          if (isEditing) {
            inputRef.current?.focus();
          }
        }, [isEditing]);

        return (
          <>
            <Checkbox
              checked={isChecked}
              onCheck={handleCheckboxToggle}
              className={styles.todoCheckbox}
            />
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editedValue}
                onChange={(e) => setEditedValue(e.currentTarget.value)}
                onKeyDown={(e) => handleKeyDown(e, saveCallback)}
                className={styles.todoInput}
              />
            ) : (
              <span className={buildClassName(styles.todoText, isChecked && styles.todoTextChecked)}>
                {originalText || <span className={styles.emptyText}>Empty to-do</span>}
              </span>
            )}
          </>
        );
      }}
    </EditableBlockWrapper>
  );
});

export default NotionToDo;
