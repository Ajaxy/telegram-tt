import type { ChangeEvent } from 'react';
import type { RefObject } from '@teact';
import { memo, useRef, useState } from '@teact';

import type { FormField, FormFieldOption } from './forms';

import { formatDateTime, toLocalISOString } from '../../../util/dates';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import CalendarModal from '../../../../components/common/CalendarModal';
import Icon from '../../../../components/common/icons/Icon';
import InputText from '../../../../components/ui/InputText';
import Select from '../../../../components/ui/Select';
import TextArea from '../../../../components/ui/TextArea';
import MultiselectDropdown from '../MultiselectDropdown';

import styles from './ProviderEntityForm.module.scss';

interface OwnProps {
  formFields: FormField[];
  handleChange: (key: string, value: string | string[]) => void;
  form: Record<string, FormField>;
}
const EntityFormFields = ({ formFields, handleChange, form }: OwnProps) => {
  const lang = useTelebizLang();
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);

  const [isCalendarOpened, setIsCalendarOpened] = useState<string | undefined>(undefined);

  const closeCalendar = () => {
    setIsCalendarOpened(undefined);
  };

  const openCalendar = (key: string) => {
    setIsCalendarOpened(key);
  };

  // Get options for a field, handling dependent fields
  const getFieldOptions = (field: FormField) => {
    // For dependent fields, options is Record<string, FormFieldOption[]>
    if (field.dependsOn && field.options && !Array.isArray(field.options)) {
      const parentValue = form[field.dependsOn]?.value as string;
      if (parentValue) {
        return field.options[parentValue];
      }
      // Default to first parent's options when parent has no value
      const firstKey = Object.keys(field.options)[0];
      return firstKey ? field.options[firstKey] : [];
    }
    // Regular fields have options as FormFieldOption[]
    return field.options as FormFieldOption[] | undefined;
  };

  return (
    <>
      {form && formFields && formFields.map((field, index) => {
        const label = field.providerLabel || (field.label ? lang(field.label) : '');
        const options = getFieldOptions(field);

        switch (field.type) {
          case 'text':
          case 'number':
            return (
              <InputText
                key={field.name}
                ref={index === 0 ? firstInputRef as RefObject<HTMLInputElement> : undefined}
                label={label}
                value={form[field.name]?.value as string || ''}
                onChange={(value) => handleChange(field.name, value.target.value)}
              />
            );
          case 'date':
            return (
              <div className={styles.calendarInput} onClick={() => openCalendar(field.name)}>
                <InputText
                  value={form[field.name]?.value ? formatDateTime(form[field.name].value as string) : ''}
                  label={label}
                  readOnly
                />
                <Icon
                  name="calendar"
                  className={styles.calendarIcon}
                  onClick={() => openCalendar(field.name)}
                />
              </div>
            );
          case 'select':
            // Skip rendering if dependent field has no options (parent not selected)
            if (field.dependsOn && (!options || options.length === 0)) {
              return undefined;
            }
            return (
              <Select
                key={field.name}
                id={field.name}
                label={label}
                value={form[field.name]?.value as string || options?.[0]?.value}
                hasArrow
                onChange={(value) => handleChange(field.name, value.target.value)}
              >
                {options?.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    selected={form[field.name]?.value === option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </Select>
            );
          case 'multiselect':
            // Skip rendering if dependent field has no options (parent not selected)
            if (field.dependsOn && (!options || options.length === 0)) {
              return undefined;
            }
            return (
              <MultiselectDropdown
                key={field.name}
                id={field.name}
                label={label}
                options={options?.map((option) => ({
                  label: option.label,
                  value: String(option.value),
                })) || []}
                selected={(form[field.name]?.value as (string | number)[] || []).map(String)}
                onChange={(value) => handleChange(field.name, value)}
              />
            );
          case 'textarea':
            return (
              <TextArea
                key={field.name}
                ref={index === 0 ? firstInputRef as RefObject<HTMLTextAreaElement> : undefined}
                label={label}
                value={form[field.name]?.value as string || ''}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                  handleChange(field.name, e.target.value);
                }}
                noReplaceNewlines
              />
            );
          default:
            return undefined;
        }
      })}
      <CalendarModal
        isOpen={Boolean(isCalendarOpened)}
        isFutureMode={form[isCalendarOpened!]?.isFutureOnly}
        withTimePicker
        onClose={closeCalendar}
        onSubmit={(date) => {
          handleChange(isCalendarOpened!, toLocalISOString(date));
          closeCalendar();
        }}
        selectedAt={
          form[isCalendarOpened!]?.value ? new Date(form[isCalendarOpened!]?.value as string).getTime() :
            new Date().getTime()
        }
        submitButtonLabel={lang('RelationshipModal.Save')}
      />

    </>
  );
};

export default memo(EntityFormFields);
