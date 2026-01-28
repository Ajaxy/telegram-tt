import type { Property } from '../../../services/types';
import { ProviderEntityType } from '../../../services/types';

export type ProviderFieldConfig = Partial<Record<ProviderEntityType, string[]>>;

// Fields for entity edit forms (all editable fields)
export const PROVIDER_FIELDS: Record<string, ProviderFieldConfig> = {
  hubspot: {
    [ProviderEntityType.Contact]: [
      'name',
      'email',
      'phone',
      'company',
      'jobTitle',
      'lifecyclestage',
      'leadStatus',
    ],
    [ProviderEntityType.Company]: [
      'name',
      'website',
      'industry',
      'type',
      'city',
      'state',
      'zip',
      'country',
      'size',
      'annualRevenue',
      'timezone',
      'description',
      'linkedinCompanyPage',
    ],
    [ProviderEntityType.Deal]: [
      'title',
      'pipeline',
      'stage',
      'amount',
      'closeDate',
      'dealType',
      'priority',
      'description',
    ],
  },
  pipedrive: {
    [ProviderEntityType.Contact]: [
      'name',
      'email',
      'phone',
      'labels',
    ],
    [ProviderEntityType.Company]: [
      'name',
      'address',
      'website',
      'linkedinCompanyPage',
      'annualRevenue',
      'size',
      'labels',
    ],
    [ProviderEntityType.Deal]: [
      'title',
      'amount',
      'pipeline',
      'stage',
      'closeDate',
      'labels',
    ],
  },
};

// Fields to display in entity overview (read-only view)
export const OVERVIEW_FIELDS: Record<string, ProviderFieldConfig> = {
  hubspot: {
    [ProviderEntityType.Contact]: [
      'company',
      'jobTitle',
      'lifecyclestage',
      'leadStatus',
    ],
    [ProviderEntityType.Company]: [
      'website',
      'industry',
      'type',
      'city',
      'state',
      'zip',
      'country',
      'size',
      'annualRevenue',
      'timezone',
      'linkedinCompanyPage',
    ],
    [ProviderEntityType.Deal]: [
      'dealType',
      'priority',
    ],
  },
  pipedrive: {
    [ProviderEntityType.Contact]: [
      'labels',
    ],
    [ProviderEntityType.Company]: [
      'address',
      'website',
      'linkedinCompanyPage',
      'annualRevenue',
      'size',
      'labels',
    ],
    [ProviderEntityType.Deal]: [
      'labels',
    ],
  },
};

// Provider-specific property field for type mapping
export const PROVIDER_TYPE_FIELD: Record<string, keyof Property> = {
  hubspot: 'type',
  pipedrive: 'fieldType',
};

export function hasDynamicFields(provider: string, entityType: ProviderEntityType): boolean {
  return Boolean(PROVIDER_FIELDS[provider]?.[entityType]);
}

export function hasOverviewFields(provider: string, entityType: ProviderEntityType): boolean {
  return Boolean(OVERVIEW_FIELDS[provider]?.[entityType]);
}

export function getFieldNamesForProvider(
  provider: string,
  entityType: ProviderEntityType,
): string[] {
  return PROVIDER_FIELDS[provider]?.[entityType] || [];
}

export function getPropertyType(property: Property, provider: string): string {
  const typeField = PROVIDER_TYPE_FIELD[provider] || 'type';
  return (property[typeField] as string) || property.type;
}

export function getOverviewFieldNames(
  provider: string,
  entityType: ProviderEntityType,
): string[] {
  return OVERVIEW_FIELDS[provider]?.[entityType] || [];
}
