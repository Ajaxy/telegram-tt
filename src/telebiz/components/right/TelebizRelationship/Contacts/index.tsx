import { memo } from '@teact';

import { type ProviderContact, ProviderEntityType } from '../../../../services/types';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';

interface Props {
  contacts: ProviderContact[];
  onContactSelected: (contact: ProviderContact) => void;
}

const RelationshipContacts = ({ contacts, onContactSelected }: Props) => {
  return (
    <RelationshipTabContainer>
      {!contacts || contacts.length === 0 ? (
        <EmptyEntityList entityType={ProviderEntityType.Contact} />
      ) : (
        <RelationshipEntityList
          items={contacts.map((contact) => ({
            ...contact,
            entityType: ProviderEntityType.Contact,
            onEntitySelected: onContactSelected,
          }))}
        />
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipContacts);
