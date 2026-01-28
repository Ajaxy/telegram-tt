import { memo, useCallback, useEffect, useRef } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import type { NotionBlock } from '../../../../services/types';

import buildClassName from '../../../../../util/buildClassName';
import { formatBlockForUpdate, getBlockText } from '../../../../util/notion';

import EditableBlockWrapper from './EditableBlockWrapper';

import styles from './NotionBlocks.module.scss';

interface Props {
  block: NotionBlock;
  integrationId: number;
  pageId: string;
}

const NotionHeading = memo(({ block, integrationId, pageId }: Props) => {
  const { updateTelebizNotionBlock } = getActions();
  const inputRef = useRef<HTMLInputElement>();

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

  const HeadingTag = block.type === 'heading_1' ? 'h1' : 'h3';
  const headingClassName = block.type === 'heading_1' ? styles.heading1 : styles.heading3;

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
      onSave={handleSave}
      className={buildClassName(styles.headingBlock, headingClassName)}
    >
      {({ isEditing, editedValue, setEditedValue, handleSave: saveCallback }) => {
        useEffect(() => {
          if (isEditing) {
            inputRef.current?.focus();
          }
        }, [isEditing]);

        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="text"
              value={editedValue}
              onChange={(e) => setEditedValue(e.currentTarget.value)}
              onKeyDown={(e) => handleKeyDown(e, saveCallback)}
              className={styles.headingInput}
            />
          );
        }

        return (
          <HeadingTag className={styles.headingText}>
            {originalText || <span className={styles.emptyText}>Empty heading</span>}
          </HeadingTag>
        );
      }}
    </EditableBlockWrapper>
  );
});

export default NotionHeading;
