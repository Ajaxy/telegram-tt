import { memo } from '@teact';

import { type ProviderCompany, ProviderEntityType } from '../../../../services/types';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';

interface Props {
  companies: ProviderCompany[];
  onCompanySelected: (company: ProviderCompany) => void;
}

const RelationshipCompanies = ({ companies, onCompanySelected }: Props) => {
  return (
    <RelationshipTabContainer>
      {!companies || companies.length === 0 ? (
        <EmptyEntityList entityType={ProviderEntityType.Company} />
      ) : (
        <RelationshipEntityList
          items={companies.map((company) => ({
            ...company,
            entityType: ProviderEntityType.Company,
            onEntitySelected: onCompanySelected,
          }))}
        />
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipCompanies);
