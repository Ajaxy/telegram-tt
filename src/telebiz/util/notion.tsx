import type { TeactNode } from '../../lib/teact/teact';

import type { FormField } from '../components/common/ProviderEntityForm/forms';
import type { TelebizLangKey } from '../lang/telebizLangPack';
import type { NotionProperty, Property, PropertyOption, ProviderPage } from '../services/types';

import { formatDateTime } from './dates';

export const getNotionPropertyText = (property: NotionProperty | undefined): string | undefined => {
  if (!property) return undefined;

  if (property.type === 'title' && property.title) {
    return property.title.map((t: any) => t.plain_text).join('');
  }

  if (property.type === 'rich_text' && property.rich_text) {
    return property.rich_text.map((t: any) => t.plain_text).join('');
  }

  return undefined;
};

export const getNotionPageTitle = (page: ProviderPage): string | undefined => {
  if (!page.properties) return undefined;

  const titleProp = Object.values(page.properties).find((p) => p.type === 'title');
  return getNotionPropertyText(titleProp);
};

export const getNotionPageStatus = (page: ProviderPage): string | undefined => {
  const status = getNotionPageStatusObject(page);
  return status?.name;
};

export const getNotionPageStatusObject = (page: ProviderPage): {
  id: string;
  name: string;
  color?: string;
} | undefined => {
  if (!page.properties) return undefined;

  const statusProp = Object.values(page.properties).find((p) => p.type === 'status');
  if (statusProp?.status) {
    return statusProp.status;
  }
  return undefined;
};

export const getNotionPageStatusProperty = (page: ProviderPage): [string, any] | undefined => {
  if (!page.properties) return undefined;
  return Object.entries(page.properties).find(([_, p]) => p.type === 'status');
};

export const getNotionPageStatusOptions = (page: ProviderPage): {
  id: string;
  name: string;
  color?: string;
}[] | undefined => {
  const statusProp = getNotionPageStatusProperty(page)?.[1];
  if (statusProp?.status && statusProp.status.options) {
    return statusProp.status.options;
  }
  return undefined;
};

export const getNotionPageProperty = (page: ProviderPage, propertyName: string): NotionProperty | undefined => {
  if (!page.properties) return undefined;
  return page.properties[propertyName];
};

export const getNotionSelectValue = (property: NotionProperty | undefined): string | undefined => {
  if (property?.type === 'select' && property.select) {
    return property.select.name;
  }
  return undefined;
};

export const getNotionPeopleNames = (property: NotionProperty | undefined): string | undefined => {
  if (property?.type === 'people' && property.people?.length > 0) {
    return property.people.map((p: any) => p.name || 'Unknown').join(', ');
  }
  return undefined;
};

export const getNotionDateValue = (
  page: ProviderPage,
): { label: string; start: string; end?: string } | undefined => {
  if (!page.properties) return undefined;

  // Check common date fields
  const dateFields = ['Date', 'Due date', 'Start date', 'End date'];
  for (const field of dateFields) {
    const prop = page.properties[field];
    if (prop?.type === 'date' && prop.date) {
      return {
        label: field,
        start: prop.date.start,
        end: prop.date.end,
      };
    }
  }
  // Fallback to searching any date property
  const anyDateProp = Object.entries(page.properties).find(([_, p]) => p.type === 'date' && p.date);
  if (anyDateProp) {
    return {
      label: anyDateProp[0],
      start: anyDateProp[1].date.start,
      end: anyDateProp[1].date.end,
    };
  }
  return undefined;
};

export const getNotionCreationDate = (page: ProviderPage): string | undefined => {
  if (!page.properties) return undefined;

  const createdTimeProp = page.properties['Created time'];
  if (createdTimeProp?.type === 'created_time' && createdTimeProp.created_time) {
    return createdTimeProp.created_time;
  }
  return undefined;
};

export const formatNotionProperty = (prop: NotionProperty): string | TeactNode | undefined => {
  switch (prop.type) {
    case 'select':
      return prop.select?.name || undefined;
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name).join(', ') || undefined;
    case 'status':
      return prop.status?.name || undefined;
    case 'date': {
      if (!prop.date) return undefined;
      const start = prop.date.start ? formatDateTime(prop.date.start) : '';
      const end = prop.date.end ? formatDateTime(prop.date.end) : '';
      if (start && end) return `${start} - ${end}`;
      return start || end;
    }
    case 'checkbox':
      return prop.checkbox ? 'Yes' : 'No';
    case 'email':
      return prop.email || undefined;
    case 'phone_number':
      return prop.phone_number || undefined;
    case 'url':
      return prop.url ? (
        <a
          href={prop.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)' } as any}
        >
          {prop.url}
        </a>
      ) : undefined;
    case 'number':
      return prop.number ? prop.number.toLocaleString() : undefined;
    case 'people':
      return prop.people?.map((p: any) => p.name || 'Unknown').join(', ') || undefined;
    case 'files':
      return prop.files?.length ? `${prop.files.length} files` : undefined;
    case 'rich_text':
      return prop.rich_text?.map((t: any) => t.plain_text).join('') || undefined;
    case 'title':
      return prop.title?.map((t: any) => t.plain_text).join('') || undefined;
    case 'formula': {
      if (prop.formula?.type === 'string') return prop.formula.string;
      if (prop.formula?.type === 'number') return prop.formula.number;
      if (prop.formula?.type === 'boolean') return prop.formula.boolean ? 'True' : 'False';
      if (prop.formula?.type === 'date') return prop.formula.date?.start;
      return undefined;
    }
    case 'created_time':
      return prop.created_time ? formatDateTime(prop.created_time) : undefined;
    case 'last_edited_time':
      return prop.last_edited_time ? formatDateTime(prop.last_edited_time) : undefined;
    default:
      return undefined;
  }
};

export const orderNotionProperties = (properties: Property[]): Property[] => {
  return properties.sort((a, b) => b.label.localeCompare(a.label)).sort((a, b) => {
    // 1. Title
    const aIsTitle = a.fieldType === 'title';
    const bIsTitle = b.fieldType === 'title';
    if (aIsTitle) return -1;
    if (bIsTitle) return 1;

    // 2. Status
    const aIsStatus = a.fieldType === 'status';
    const bIsStatus = b.fieldType === 'status';
    if (aIsStatus) return -1;
    if (bIsStatus) return 1;

    // 3. Select
    const aIsSelect = a.fieldType === 'select';
    const bIsSelect = b.fieldType === 'select';
    if (aIsSelect) return -1;
    if (bIsSelect) return 1;

    // 4. Priority
    const aIsPriority = a.fieldType === 'multi_select';
    const bIsPriority = b.fieldType === 'multi_select';
    if (aIsPriority) return -1;
    if (bIsPriority) return 1;

    // 5. Date
    const aIsDate = a.fieldType === 'date';
    const bIsDate = b.fieldType === 'date';
    if (aIsDate) return -1;
    if (bIsDate) return 1;

    return 0;
  });
};

export const getCreationFields = (properties: Property[]): Property[] => {
  return orderNotionProperties(properties).slice(0, 5);
};

export const getFirstSelectProperty = (properties: Property[]): Property | undefined => {
  return orderNotionProperties(properties).find((prop: Property) => prop.options?.length);
};

export const convertNotionPropertiesToFormFields = (
  properties: Property[],
  entityProperties: Record<string, NotionProperty>,
): FormField[] => {
  return orderNotionProperties(properties).map((prop: Property) => {
    const entityProp = entityProperties[prop.name];
    const field: Partial<FormField> = {
      name: prop.name,
      label: prop.label as TelebizLangKey,
      value: entityProp?.value || '',
      metadata: entityProp?.metadata || prop,
    };

    switch (prop.fieldType) {
      case 'title':
        field.type = 'text';
        field.value = getNotionPropertyText(entityProp) || undefined;
        break;
      case 'rich_text':
        field.type = 'textarea';
        field.value = getNotionPropertyText(entityProp) || undefined;
        break;
      case 'number':
        field.type = 'number';
        field.value = entityProp?.number ? String(entityProp.number) : undefined;
        break;
      case 'select':
      case 'status':
        field.type = 'select';
        field.value = entityProp?.select?.id || entityProp?.status?.id || undefined;
        if (prop.options && Array.isArray(prop.options) && prop.options.length) {
          field.value = field.value || prop.options[0].value;
          field.options = prop.options?.map((opt: PropertyOption) => ({
            label: opt.label,
            value: opt.value,
          }));
        }
        break;
      case 'multi_select':
        field.type = 'multiselect';
        field.value = entityProp?.multi_select?.map((s: any) => s.id) || undefined;
        if (prop.options && Array.isArray(prop.options) && prop.options.length) {
          field.options = prop.options?.map((option: PropertyOption) => ({
            label: option.label,
            value: option.value,
          }));
        }
        break;
      case 'date':
        field.type = 'date';
        field.value = entityProp?.date?.start || undefined;
        break;
      case 'email':
        field.type = 'text';
        field.value = entityProp?.email || undefined;
        break;
      case 'phone_number':
        field.type = 'text';
        field.value = entityProp?.phone_number || undefined;
        break;
      case 'url':
        field.type = 'text';
        field.value = entityProp?.url || '';
        break;
      case 'checkbox':
        field.type = 'select';
        field.value = entityProp?.checkbox ? 'Yes' : 'No';
        field.options = [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }];
        break;
      default:
        return undefined;
    }

    return field as FormField;
  }).filter(Boolean);
};

// Block utility functions
export const getBlockText = (richText: any[]): string => {
  if (!richText || richText.length === 0) return '';
  return richText.map((t: any) => t.plain_text || '').join('');
};

export const formatBlockForUpdate = (blockType: string, text: string, additionalData?: any): any => {
  const richText = text ? [{ text: { content: text } }] : [];

  switch (blockType) {
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return {
        [blockType]: {
          rich_text: richText,
        },
      };
    case 'paragraph':
      return {
        paragraph: {
          rich_text: richText,
        },
      };
    case 'to_do':
      return {
        to_do: {
          rich_text: richText,
          checked: additionalData?.checked ?? false,
        },
      };
    default:
      return {};
  }
};

export const getBlockIcon = (blockType: string): string => {
  switch (blockType) {
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return 'text';
    case 'paragraph':
      return 'document';
    case 'to_do':
      return 'checkbox';
    default:
      return 'document';
  }
};

export const convertFormFieldsToNotionProperties = (
  form: Record<string, FormField>,
  properties: Property[],
): Record<string, any> => {
  const notionPayload: Record<string, any> = {};
  Object.entries(form).forEach(([key, val]) => {
    const prop = properties.find((p) => p.name === key);
    if (!prop || !val.value) return;

    if (prop.fieldType === 'status') {
      notionPayload[key] = { status: { id: val.value } };
    } else if (prop.fieldType === 'select') {
      notionPayload[key] = { select: { id: val.value } };
    } else if (prop.fieldType === 'multi_select') {
      notionPayload[key] = { multi_select: (val.value as string[]).map((v: string) => ({ id: v })) };
    } else if (prop.fieldType === 'title') {
      notionPayload[key] = { title: [{ text: { content: val.value } }] };
    } else if (prop.fieldType === 'rich_text') {
      notionPayload[key] = { rich_text: [{ text: { content: val.value } }] };
    } else if (prop.fieldType === 'number') {
      notionPayload[key] = { number: Number(val.value) };
    } else if (prop.fieldType === 'date') {
      notionPayload[key] = { date: { start: val.value } };
    } else if (prop.fieldType === 'email') {
      notionPayload[key] = { email: val.value };
    } else if (prop.fieldType === 'phone_number') {
      notionPayload[key] = { phone_number: val.value };
    } else if (prop.fieldType === 'url') {
      notionPayload[key] = { url: val.value };
    } else if (prop.fieldType === 'checkbox') {
      notionPayload[key] = { checkbox: val.value === 'Yes' };
    }

    if (val.metadata?.id) {
      notionPayload[key].id = val.metadata.id;
    }
  });
  return notionPayload;
};

export const decodeEntityId = (compositeId: string): [string, string | undefined] => {
  if (compositeId.includes('::')) {
    const parts = compositeId.split('::');
    return [parts[0], parts[1]];
  }
  return [compositeId, undefined];
};
