import { memo, useMemo, useState } from '@teact';

import type { NotionBlock } from '../../../../services/types';

import { EditingContext } from './EditingContext';
import NotionHeading from './NotionHeading';
import NotionParagraph from './NotionParagraph';
import NotionToDo from './NotionToDo';

import styles from './NotionBlocks.module.scss';

interface Props {
  blocks: NotionBlock[];
  pageId: string;
  integrationId: number;
}

const SUPPORTED_BLOCK_TYPES = ['heading_1', 'heading_3', 'paragraph', 'to_do'];

const NotionBlocks = memo(({ blocks, pageId, integrationId }: Props) => {
  const [editingBlockId, setEditingBlockId] = useState<string | undefined>();
  const supportedBlocks = blocks.filter((block) => SUPPORTED_BLOCK_TYPES.includes(block.type));

  const contextValue = useMemo(() => ({
    editingBlockId,
    setEditingBlockId,
  }), [editingBlockId]);

  if (supportedBlocks.length === 0) {
    return undefined;
  }

  const renderBlock = (block: NotionBlock) => {
    switch (block.type) {
      case 'heading_1':
      case 'heading_3':
        return (
          <NotionHeading
            key={block.id}
            block={block}
            integrationId={integrationId}
            pageId={pageId}
          />
        );
      case 'paragraph':
        return (
          <NotionParagraph
            key={block.id}
            block={block}
            integrationId={integrationId}
            pageId={pageId}
          />
        );
      case 'to_do':
        return (
          <NotionToDo
            key={block.id}
            block={block}
            integrationId={integrationId}
            pageId={pageId}
          />
        );
      default:
        return undefined;
    }
  };

  return (
    <EditingContext.Provider value={contextValue}>
      <section className={styles.container}>
        <div className={styles.blocksList}>
          {supportedBlocks.map(renderBlock)}
        </div>
      </section>
    </EditingContext.Provider>
  );
});

export default NotionBlocks;
