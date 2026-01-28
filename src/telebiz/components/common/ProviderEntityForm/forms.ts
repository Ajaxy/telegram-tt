import type { TelebizLangKey } from '../../../lang/telebizLangPack';
import type { Property } from '../../../services/types';
import { ProviderEntityType, StandardPropertyType } from '../../../services/types';

import { toLocalISOString } from '../../../util/dates';
import { formatSnakeCaseLabel } from '../../../util/general';
import {
  getFieldNamesForProvider,
  getPropertyType,
  hasDynamicFields,
  PROVIDER_FIELDS,
} from './fieldConfig';

export { getFieldNamesForProvider, hasDynamicFields, PROVIDER_FIELDS };

export interface FormFieldOption {
  label: string;
  value: string;
}

export type FormField = {
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'multiselect';
  label?: TelebizLangKey;
  providerLabel?: string;
  value: string | string[];
  name: string;
  // For regular fields: FormFieldOption[], for dependent fields: Record<string, FormFieldOption[]>
  options?: FormFieldOption[] | Record<string, FormFieldOption[]>;
  // Name of the field this one depends on
  dependsOn?: string;
  metadata?: any;
  // For date fields: only allow future dates (default: false for dynamic fields, true for scheduling)
  isFutureOnly?: boolean;
};

function mapPropertyTypeToFormType(propertyType: StandardPropertyType): FormField['type'] {
  switch (propertyType) {
    case StandardPropertyType.TEXT:
    case StandardPropertyType.EMAIL:
    case StandardPropertyType.PHONE:
    case StandardPropertyType.URL:
    case StandardPropertyType.BOOLEAN:
    case StandardPropertyType.USER:
      return 'text';
    case StandardPropertyType.TEXTAREA:
      return 'textarea';
    case StandardPropertyType.NUMBER:
    case StandardPropertyType.CURRENCY:
      return 'number';
    case StandardPropertyType.DATE:
    case StandardPropertyType.DATETIME:
      return 'date';
    case StandardPropertyType.SELECT:
    case StandardPropertyType.STATUS:
    case StandardPropertyType.STAGE:
    case StandardPropertyType.ENUM:
      return 'select';
    case StandardPropertyType.MULTISELECT:
    case StandardPropertyType.SET:
      return 'multiselect';
    default:
      return 'text';
  }
}

function getDefaultValue(propertyType: StandardPropertyType): string | string[] {
  switch (propertyType) {
    case StandardPropertyType.DATE:
    case StandardPropertyType.DATETIME:
      return toLocalISOString(new Date());
    case StandardPropertyType.NUMBER:
    case StandardPropertyType.CURRENCY:
      return '0';
    case StandardPropertyType.MULTISELECT:
      return [];
    default:
      return '';
  }
}

export function buildFormFieldsFromProperties(
  fieldNames: string[],
  properties: Property[],
  provider: string,
): FormField[] {
  return fieldNames
    .map((name) => {
      const property = properties.find((p) => p.standardName === name);
      if (!property) return undefined;

      const propertyType = getPropertyType(property, provider) as StandardPropertyType;
      const formType = mapPropertyTypeToFormType(propertyType);

      return {
        name,
        providerLabel: formatSnakeCaseLabel(property.label),
        type: formType,
        options: property.options,
        dependsOn: property.dependsOn,
        value: getDefaultValue(propertyType),
      } as FormField;
    })
    .filter((field): field is FormField => field !== undefined);
}

// Static forms for entity types or providers without dynamic properties support
export const forms: Partial<Record<ProviderEntityType, FormField[]>> = {
  [ProviderEntityType.Contact]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Name',
        value: '',
        name: 'name',
      },
      {
        type: 'text',
        label: 'RelationshipModal.Phone',
        value: '',
        name: 'phone',
      },
      {
        type: 'text',
        label: 'RelationshipModal.Email',
        value: '',
        name: 'email',
      },
    ],
  [ProviderEntityType.Company]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Name',
        value: '',
        name: 'name',
      },
      {
        type: 'text',
        label: 'RelationshipModal.Website',
        value: '',
        name: 'website',
      },
    ],
  [ProviderEntityType.Deal]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Title',
        value: '',
        name: 'title',
      },
      {
        type: 'number',
        label: 'RelationshipModal.Amount',
        value: '0',
        name: 'amount',
      },
      {
        type: 'date',
        label: 'RelationshipModal.CloseDate',
        value: toLocalISOString(new Date()),
        name: 'closeDate',
      },
    ],
  [ProviderEntityType.Meeting]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Title',
        value: '',
        name: 'title',
      },
      {
        type: 'date',
        label: 'RelationshipModal.StartDate',
        value: toLocalISOString(new Date()),
        name: 'startDate',
        isFutureOnly: true,
      },
      {
        type: 'select',
        label: 'RelationshipModal.Duration',
        value: '15',
        options: [
          { label: '15', value: '15' },
          { label: '30', value: '30' },
          { label: '45', value: '45' },
          { label: '60', value: '60' },
          { label: '120', value: '120' },
        ],
        name: 'duration',
      },
    ],
  [ProviderEntityType.Note]:
    [
      {
        type: 'textarea',
        label: 'RelationshipModal.Text',
        value: '',
        name: 'body',
      },
    ],
  [ProviderEntityType.Task]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Title',
        value: '',
        name: 'subject',
      },
      {
        type: 'date',
        label: 'RelationshipModal.Date',
        value: toLocalISOString(new Date()),
        name: 'date',
        isFutureOnly: true,
      },
      {
        type: 'textarea',
        label: 'RelationshipModal.Text',
        value: '',
        name: 'body',
      },
      {
        type: 'select',
        label: 'RelationshipModal.TaskType',
        value: 'TODO',
        options: [
          { label: 'To-do', value: 'TODO' },
          { label: 'Email', value: 'EMAIL' },
          { label: 'Call', value: 'CALL' },
        ],
        name: 'taskType',
      },
      {
        type: 'select',
        label: 'RelationshipModal.Priority',
        value: 'NONE',
        options: [
          { label: 'Low', value: 'LOW' },
          { label: 'Medium', value: 'MEDIUM' },
          { label: 'High', value: 'HIGH' },
          { label: 'None', value: 'NONE' },
        ],
        name: 'priority',
      },
    ],
  [ProviderEntityType.Organization]:
    [],
  [ProviderEntityType.Page]:
    [
      {
        type: 'text',
        label: 'RelationshipModal.Title',
        value: '',
        name: 'title',
      },
    ],
};
