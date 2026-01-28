import { memo } from '@teact';

import type { ProviderDeal } from '../../../../services/types';
import { ProviderEntityType } from '../../../../services/types';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';

interface Props {
  deals: ProviderDeal[];
}

const RelationshipDeals = ({ deals }: Props) => {
  return (
    <RelationshipTabContainer>
      {!deals || deals.length === 0 ? (
        <EmptyEntityList entityType={ProviderEntityType.Deal} />
      ) : (
        <RelationshipEntityList
          items={deals.map((deal) => ({
            ...deal,
            entityType: ProviderEntityType.Deal,
          }))}
        />
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipDeals);
