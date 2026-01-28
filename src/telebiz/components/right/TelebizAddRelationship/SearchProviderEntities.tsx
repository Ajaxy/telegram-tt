import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type {
  Property,
  ProviderCompany,
  ProviderContact, ProviderDeal, ProviderPage,
} from '../../../services';

import {
  selectTelebizProperties,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getEntityDisplayString } from '../../../util/general';
import {
  getNotionPageProperty,
  getNotionPageStatus,
  getNotionPageTitle,
  getNotionSelectValue,
} from '../../../util/notion';
import { ProviderEntityType } from '../../../services';

import { useProviderProperty } from '../../../hooks/useProviderProperty';

import InputText from '../../../../components/ui/InputText';
import ListItem from '../../../../components/ui/ListItem';
import Loading from '../../../../components/ui/Loading';
import { IntegrationsApiClient } from '../../../services/api/IntegrationsApiClient';
import TelebizFeaturesList from '../../common/TelebizFeaturesList';

import styles from './TelebizAddRelationship.module.scss';

interface OwnProps {
  entityType: ProviderEntityType;
  integrationId?: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  disabled?: boolean;
  setSelectedEntity: (
    entity: ProviderContact | ProviderDeal | ProviderPage | ProviderCompany,
    entityType: ProviderEntityType,
  ) => void;
  onCreateEntity: () => void;
  excludedIds?: string[];
}

type StateProps = {
  properties: Property[];
};

function buildDealDescription(
  deal: ProviderDeal,
  getPropertyValueFromOptions: ReturnType<typeof useProviderProperty>['getPropertyValueFromOptions'],
) {
  const parts: string[] = [];

  const pipelineValue = getPropertyValueFromOptions(deal.pipeline, 'pipeline');
  const stageValue = getPropertyValueFromOptions(deal.stage, 'stage', deal.pipeline);

  if (deal.stage) {
    parts.push(pipelineValue);
    parts.push(stageValue);
  }
  const ownerName = deal.metadata?.owner?.name;
  if (ownerName) parts.push(ownerName);
  const personName = deal.metadata?.person?.name;
  const organizationName = deal.metadata?.organization?.name;
  if (personName) parts.push(personName);
  else if (organizationName) parts.push(organizationName);
  if (deal.status) parts.push(deal.status);

  if (typeof deal.amount === 'number' && deal.currency) {
    try {
      const formattedAmount = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: deal.currency,
      }).format(deal.amount);
      parts.push(formattedAmount);
    } catch {
      parts.push(`${deal.amount} ${deal.currency}`);
    }
  }

  return parts.join(' · ');
}

const buildPageDescription = (page: ProviderPage) => {
  const parts: string[] = [];

  if (page.properties) {
    const statusName = getNotionPageStatus(page);
    if (statusName) {
      parts.push(statusName);
    }

    const priorityProp = getNotionPageProperty(page, 'Priority');
    const priorityName = getNotionSelectValue(priorityProp);
    if (priorityName) {
      parts.push(priorityName);
    }
  }

  return parts.join(' · ');
};

const SearchProviderEntities: FC<OwnProps & StateProps> = ({
  entityType,
  searchQuery,
  setSearchQuery,
  disabled = false,
  setSelectedEntity,
  onCreateEntity,
  excludedIds,
  properties,
  integrationId,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchResults, setSearchResults] = useState<(ProviderContact | ProviderDeal | ProviderPage)[]>([]);
  const apiClient = useMemo(() => new IntegrationsApiClient(), []);

  const { getPropertyValueFromOptions } = useProviderProperty(properties);

  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
    }
    setSearchResults([]);
  }, [integrationId, searchQuery]);

  const handleSearch = useCallback(async (query: string) => {
    setIsTyping(false);
    if (!integrationId) return;

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (query.trim()) {
      setIsSearching(true);
      if (!integrationId) return;
      try {
        const results = await apiClient.searchProviderEntities(integrationId, entityType, query, 50, 0);
        const filteredResults = excludedIds && excludedIds.length > 0
          ? results.filter((item) => !excludedIds.includes(item.id))
          : results;
        setSearchResults(filteredResults);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }
  }, [integrationId, apiClient, entityType, excludedIds]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIsTyping(true);
    setSearchQuery(value);
  }, [setSearchQuery, setIsTyping]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]);

  const getEntityDetails = useCallback((
    entity: ProviderContact | ProviderDeal | ProviderPage,
  ) => {
    switch (entityType) {
      case ProviderEntityType.Deal: {
        const deal = entity as ProviderDeal;
        const description = buildDealDescription(deal, getPropertyValueFromOptions);
        return (
          <>
            <div className={styles.searchResultsItemName}>{deal.title}</div>
            <div className={styles.searchResultsItemDescription}>{description}</div>
          </>
        );
      }
      case ProviderEntityType.Contact: {
        return (
          <>
            <div className={styles.searchResultsItemName}>{(entity as ProviderContact).name}</div>
            <div className={styles.searchResultsItemDescription}>{(entity as ProviderContact).email}</div>
          </>
        );
      }
      case ProviderEntityType.Company: {
        return (
          <>
            <div className={styles.searchResultsItemName}>{(entity as ProviderCompany).name}</div>
            <div className={styles.searchResultsItemDescription}>{(entity as ProviderCompany).website}</div>
          </>
        );
      }
      case ProviderEntityType.Page: {
        const page = entity as ProviderPage;
        const pageProperties = properties.find((p) => p.id === page.parent?.database_id);
        const description = buildPageDescription(page);
        const title = getNotionPageTitle(page) || 'Untitled';

        return (
          <>
            <div className={styles.searchResultsItemName}>{title}</div>
            {pageProperties?.label && (
              <div className={styles.searchResultsItemDescription}>{pageProperties?.label}</div>
            )}
            <div className={styles.searchResultsItemDescription}>{description}</div>
          </>
        );
      }
      default:
        return undefined;
    }
  }, [entityType, getPropertyValueFromOptions, properties]);

  const hasIntegration = Boolean(integrationId);

  return (
    <>
      {hasIntegration && (
        <div className={styles.searchEntity}>
          <InputText
            id="telebiz-add-relationship-search"
            className={styles.searchEntityInput}
            placeholder={`Search / Create ${getEntityDisplayString(entityType)}`}
            disabled={disabled}
            onChange={handleSearchChange}
            value={searchQuery}
          />
        </div>
      )}
      {!searchQuery && (
        <TelebizFeaturesList
          showWelcome
        />
      )}
      {hasIntegration && (isSearching || isTyping) && <Loading />}
      {hasIntegration && !isSearching && !isTyping && searchQuery && (
        <div className={buildClassName(styles.searchResults, 'custom-scroll')}>
          {searchResults.length > 0 ? searchResults.map((result) => (
            <ListItem
              key={result.id}
              className={styles.searchResultsItem}
              multiline
              onClick={() => setSelectedEntity(result, entityType)}
            >
              {getEntityDetails(result)}
            </ListItem>
          )) : (
            <ListItem className={styles.searchResultsItem} isStatic disabled>
              No results found
            </ListItem>
          )}
          <ListItem
            className={styles.searchResultsItem}
            icon="add"
            withPrimaryColor
            onClick={onCreateEntity}
          >
            Create new
            {' '}
            {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </ListItem>
        </div>
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { entityType, integrationId }): StateProps => {
    const properties = integrationId ? selectTelebizProperties(global, integrationId) : [];
    return {
      properties: properties.find((p) => p.id as ProviderEntityType === entityType)?.properties || [],
    };
  },
)(SearchProviderEntities));
