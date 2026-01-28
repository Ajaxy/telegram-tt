import { memo, useCallback, useEffect, useRef } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import type { NotionBlock } from '../../../../services/types';

import { formatBlockForUpdate, getBlockText } from '../../../../util/notion';

import EditableBlockWrapper from './EditableBlockWrapper';

import styles from './NotionBlocks.module.scss';

interface Props {
  block: NotionBlock;
  integrationId: number;
  pageId: string;
}

const NotionParagraph = memo(({ block, integrationId, pageId }: Props) => {
  const { updateTelebizNotionBlock } = getActions();
  const textareaRef = useRef<HTMLTextAreaElement>();

  const blockData = block[block.type];
  const originalText = blockData?.rich_text ? getBlockText(blockData.rich_text) : '';

  const handleSave = useCallback(async (newText: string) => {
    updateTelebizNotionBlock({
      integrationId,
      pageId,
      blockId: block.id,
      blockData: formatBlockForUpdate(block.type, newText),
    });
  }, [updateTelebizNotionBlock, integrationId, pageId, block.id, block.type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, saveCallback: () => void) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveCallback();
    }
  }, []);

  return (
    <EditableBlockWrapper
      blockId={block.id}
      originalValue={originalText}
      onSave={handleSave}
      className={styles.paragraphBlock}
    >
      {({ isEditing, editedValue, setEditedValue, handleSave: saveCallback }) => {
        useEffect(() => {
          if (isEditing) {
            textareaRef.current?.focus();
          }
        }, [isEditing]);

        if (isEditing) {
          return (
            <textarea
              ref={textareaRef}
              value={editedValue}
              onChange={(e) => setEditedValue(e.currentTarget.value)}
              onKeyDown={(e) => handleKeyDown(e, saveCallback)}
              className={styles.paragraphTextarea}
              rows={3}
            />
          );
        }

        return (
          <p className={styles.paragraphText}>
            {originalText || <span className={styles.emptyText}>Empty paragraph</span>}
          </p>
        );
      }}
    </EditableBlockWrapper>
  );
});

export default NotionParagraph;
