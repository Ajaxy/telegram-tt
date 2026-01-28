import { memo } from '@teact';

import type { Integration, ProviderPage } from '../../../../services/types';

import NotionBlocks from './';

import RelationshipTabContainer from '../RelationshipTabContainer';

interface Props {
  entity: ProviderPage;
  integration: Integration;
}

const RelationshipContent = ({ entity, integration }: Props) => {
  return (
    <RelationshipTabContainer>
      {entity && 'blocks' in entity && entity.blocks && integration && (
        <NotionBlocks blocks={entity.blocks} pageId={entity.id} integrationId={integration.id} />
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipContent);
