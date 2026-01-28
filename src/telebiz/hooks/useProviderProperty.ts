import { useCallback } from '../../lib/teact/teact';

import type {
  Property,
  PropertyOption,
  ProviderEntity,
} from '../services/types';
import { StandardPropertyType } from '../services/types';

import { formatDate } from '../util/dates';
import { capitalizeFirstLetter } from '../util/general';

import { getPropertyType } from '../components/common/ProviderEntityForm/fieldConfig';

// Fields that represent currency values
const CURRENCY_FIELDS: Record<string, string[]> = {
  hubspot: ['amount', 'annualRevenue'],
  pipedrive: ['amount'],
};

function formatCurrency(value: number | string, currency = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(numValue)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numValue);
}

export function useProviderProperty(
  providerProperties: Property[],
) {
  const getPropertyLabel = useCallback((propertyName?: string) => {
    if (!propertyName) return '';
    const label = providerProperties?.find((p) => p.standardName === propertyName)?.label;
    return label ? capitalizeFirstLetter(label.replace('_', ' ')) : '';
  }, [providerProperties]);

  const getPropertyOptions = useCallback((propertyName?: string) => {
    if (!providerProperties) return '';

    const property = providerProperties.find((p: Property) => p.standardName === propertyName);
    return property?.options || [];
  }, [providerProperties]);

  const getPropertyValueFromOptions = useCallback((
    value?: string,
    propertyName?: string,
    dependsOnValue?: string,
  ) => {
    if (!propertyName || !value) return '';

    const property = providerProperties?.find((p: Property) => p.standardName === propertyName);
    if (!property?.options) return '';

    const findLabel = (options: PropertyOption[]) => options.find((o) => o.value === value)?.label || '';

    if (dependsOnValue && property.dependsOn) {
      const nestedOptions = (property.options as Record<string, PropertyOption[]>)[dependsOnValue];
      return nestedOptions ? findLabel(nestedOptions) : '';
    }

    return findLabel(property.options as PropertyOption[]);
  }, [providerProperties]);

  const getProviderPropertyValue = useCallback((propertyName: string, value: string) => {
    if (!propertyName || !value) return '';
    const property = providerProperties?.find((p: Property) => p.standardName === propertyName);
    if (!property) return '';
    if (property.options) {
      return (property.options as PropertyOption[])?.find((o) => o.value === value)?.label || '';
    }
    return value;
  }, [providerProperties]);

  const getProbabilityFromStage = useCallback((stage: string, pipeline: string) => {
    if (!providerProperties) return 0;
    const property = providerProperties.find((p: Property) => p.standardName === 'stage');
    if (!property || !property.options) return 0;
    const stageOptions = (property.options as Record<string, PropertyOption[]>)[pipeline];
    const probability = stageOptions?.find((o) => o.value === stage)?.probability;
    return probability !== undefined ? probability / 100 : 0;
  }, [providerProperties]);

  const formatPropertyValue = useCallback((
    entity: ProviderEntity,
    fieldName: string,
    provider?: string,
  ): string => {
    if (!provider) return '';

    const rawValue = (entity as unknown as Record<string, unknown>)[fieldName];
    if (rawValue === undefined || rawValue === '') return '';

    const property = providerProperties?.find((p) => p.standardName === fieldName);

    if (!property) return '';

    const propertyType = getPropertyType(property, provider) as StandardPropertyType;

    // Currency fields
    if (CURRENCY_FIELDS[provider]?.includes(fieldName)) {
      const currency = 'currency' in entity ? (entity as { currency?: string }).currency : 'USD';
      return formatCurrency(rawValue as number | string, currency);
    }

    // Date fields
    if (propertyType === StandardPropertyType.DATE || propertyType === StandardPropertyType.DATETIME) {
      return formatDate(rawValue as string);
    }

    // Resolve options for fields with dependsOn or flat options
    const resolveOptions = (): PropertyOption[] | undefined => {
      if (!property?.options) return undefined;
      if (property.dependsOn) {
        const dependsOnValue = (entity as unknown as Record<string, unknown>)[property.dependsOn] as string;
        if (!dependsOnValue) return undefined;
        return (property.options as Record<string, PropertyOption[]>)[dependsOnValue];
      }
      return property.options as PropertyOption[];
    };

    // Select/enum fields with options
    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      if (
        propertyType === StandardPropertyType.SELECT
        || propertyType === StandardPropertyType.ENUM
        || propertyType === StandardPropertyType.STATUS
        || propertyType === StandardPropertyType.STAGE
      ) {
        const options = resolveOptions();
        return options?.find((o) => o.value === rawValue)?.label || '';
      }
    }

    // Multiselect/set fields with options (array values)
    if (Array.isArray(rawValue)) {
      if (propertyType === StandardPropertyType.MULTISELECT || propertyType === StandardPropertyType.SET) {
        const options = resolveOptions();
        if (options) {
          return rawValue
            .map((v) => options.find((o) => o.value === v)?.label || v)
            .join(', ');
        }
      }
      return rawValue.join(', ');
    }

    return typeof rawValue === 'string' ? rawValue : '';
  }, [providerProperties]);

  return {
    getPropertyLabel,
    getPropertyOptions,
    getPropertyValueFromOptions,
    getProviderPropertyValue,
    getProbabilityFromStage,
    formatPropertyValue,
  };
}
