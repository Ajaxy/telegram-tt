import type {
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderEntity,
  ProviderItemOwner,
  ProviderPage,
} from '../services/types';
import {
  ProviderEntityType,
} from '../services/types';

import { getNotionPageTitle } from './notion';

export const getOwnerDisplayString = (owner: ProviderItemOwner, defaultEmail = true) => {
  return owner ? (owner.firstName || owner.lastName)
    ? `${owner.firstName} ${owner.lastName}`.trim() : (defaultEmail ? owner.email : '') : '';
};

export const getEntityDisplayString = (entityType: ProviderEntityType) => {
  return capitalizeFirstLetter(entityType);
};

export const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export const formatSnakeCaseLabel = (label: string): string => {
  return label
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const getEntityTitle = (entity: ProviderEntity, type: ProviderEntityType) => {
  switch (type) {
    case ProviderEntityType.Deal:
      return (entity as ProviderDeal).title;
    case ProviderEntityType.Contact:
      return (entity as ProviderContact).name;
    case ProviderEntityType.Company:
      return (entity as ProviderCompany).name;
    case ProviderEntityType.Page:
      return getNotionPageTitle(entity as ProviderPage) || '';
    default:
      return '';
  }
};

export const delay = function (t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
};

export const isJsonString = (str?: string): boolean => {
  if (!str) return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

export const parseJsonMessage = (message: string): any => {
  const match = message.match(/\[.*\]$/);

  let parsedArray: any[] = [];

  if (match) {
    try {
      parsedArray = JSON.parse(match[0]);
    } catch (err) {
      throw new Error('Failed to parse JSON array');
    }
  }

  return parsedArray;
};

export const getDealColorByProbability = (probability: number) => {
  return Number(probability) > 0.75 ? 'green' : Number(probability) > 0.25 ? 'yellow' : 'red';
};

export const getLifecycleStageColor = (currentIndex: number, totalStages: number) => {
  if (totalStages <= 1 || currentIndex < 0) return 'purple';
  const progress = currentIndex / (totalStages - 1);
  if (progress >= 0.75) return 'green';
  if (progress >= 0.5) return 'yellow';
  if (progress >= 0.25) return 'orange';
  return 'blue';
};

export const getPageStatusColor = (status: {
  id: string;
  name: string;
  color?: string;
}) => {
  return status?.color || 'white';
};

export function getProviderEntityUrl(
  providerName: string,
  entityType: ProviderEntityType,
  entityId: string,
  portalId?: string,
): string | undefined {
  const provider = providerName.toLowerCase();

  if (provider === 'hubspot' && portalId) {
    const hubspotEntityMap: Record<string, string> = {
      [ProviderEntityType.Contact]: 'contact',
      [ProviderEntityType.Deal]: 'deal',
      [ProviderEntityType.Company]: 'company',
    };
    const hubspotEntityType = hubspotEntityMap[entityType];
    if (hubspotEntityType) {
      return `https://app.hubspot.com/contacts/${portalId}/${hubspotEntityType}/${entityId}`;
    }
  }

  if (provider === 'pipedrive') {
    const pipedriveEntityMap: Record<string, string> = {
      [ProviderEntityType.Contact]: 'person',
      [ProviderEntityType.Deal]: 'deal',
      [ProviderEntityType.Company]: 'organization',
    };
    const pipedriveEntityType = pipedriveEntityMap[entityType];
    if (pipedriveEntityType) {
      return `https://app.pipedrive.com/${pipedriveEntityType}/${entityId}`;
    }
  }

  return undefined;
}
