import { memo, useCallback, useEffect, useMemo, useRef, useState } from '../../../../../lib/teact/teact';
import { withGlobal } from '../../../../../global';

import type { PropertiesByEntityType } from '../../../../services';
import type { FormField } from '../../../common/ProviderEntityForm/forms';

import { selectTelebizProperties, selectTelebizSelectedIntegrationId } from '../../../../global/selectors';
import { disableDirectTextInput, enableDirectTextInput } from '../../../../../util/directInputManager';
import {
  convertFormFieldsToNotionProperties,
  convertNotionPropertiesToFormFields,
  getCreationFields,
} from '../../../../util/notion';
import { type CreateProviderEntityData } from '../../../../services';

import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import EntityFormFields from '../../../../components/common/ProviderEntityForm/ProviderEntityFormFields';
import LabelList from '../../../common/LabelList';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  initialTitle: string;
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  error?: string;
}

type StateProps = {
  properties: PropertiesByEntityType[];
};

const CreatePageForm = ({
  initialTitle,
  onCreate,
  error,
  properties,
}: OwnProps & StateProps) => {
  const titleRef = useRef<HTMLInputElement | undefined>(undefined);

  const [selectedDatabase, setSelectedDatabase] = useState<PropertiesByEntityType | undefined>();

  const [form, setForm] = useState<Record<string, FormField>>({});
  const [initialized, setInitialized] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const lang = useTelebizLang();

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus();
    }
  }, [titleRef]);

  useEffect(() => {
    if (properties.length > 0 && !selectedDatabase) {
      setSelectedDatabase(properties[0]);
    }
  }, [properties, selectedDatabase]);

  const handleChange = useCallback((key: string, value: string | string[]) => {
    setForm({ ...form, [key]: { ...form[key], value } });
  }, [form]);

  const { formFields, entityProperties } = useMemo(() => {
    const props = properties.find((e) => e.id === selectedDatabase?.id)?.properties;
    if (props?.length) {
      const createProperties = getCreationFields(props);
      const titleProperty = props.find((p) => p.fieldType === 'title');
      const titleField = titleProperty
        ? { [titleProperty?.name]: { title: [{ plain_text: initialTitle }], id: 'title', type: 'title' } }
        : {};

      return {
        formFields: convertNotionPropertiesToFormFields(
          createProperties,
          titleField,
        ),
        entityProperties: props,
      };
    }
    return {};
  }, [selectedDatabase?.id, properties, initialTitle]);

  useEffect(() => {
    if (!formFields) return;

    setInitialized(true);

    setForm(formFields.reduce((acc, field) => {
      acc[field.name] = { ...field, value: field.value };
      return acc;
    }, {} as Record<string, FormField>));
  }, [formFields]);

  const clearForm = useCallback(() => {
    setForm({});
    setSelectedDatabase(undefined);
  }, []);

  const isFormValid = useCallback(() => {
    if (!formFields) return false;
    return formFields?.some((field) => {
      const value = form[field.name]?.value;
      return value !== undefined && value !== '';
    }) || false;
  }, [formFields, form]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid() || !entityProperties) return;
    setIsLoading(true);
    const entityData = convertFormFieldsToNotionProperties(form, entityProperties);
    try {
      const createData: Partial<CreateProviderEntityData> = {
        properties: entityData,
        databaseId: selectedDatabase?.id,
      };

      await onCreate(createData);
      clearForm();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isFormValid, form, selectedDatabase?.id, onCreate, clearForm, entityProperties]);

  return (
    <form
      onSubmit={handleCreate}
      onFocus={() => disableDirectTextInput()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          enableDirectTextInput();
        }
      }}
    >
      <div className={styles.formContent}>
        {properties.length > 0 && (
          <LabelList
            labels={properties.map((database) => ({
              id: database.id,
              title: database.label || '',
              isActive: selectedDatabase?.id === database.id,
            }))}
            activeLabel={properties.findIndex((p) => p.id === selectedDatabase?.id)}
            onSwitchLabel={(index) => setSelectedDatabase(properties[index])}
            className={styles.databaseSelection}
            activeClassName={styles.databaseSelectionActive}
            labelClassName={styles.entityTypeButton}
          />
        )}
        {selectedDatabase && initialized
          && <EntityFormFields formFields={formFields || []} handleChange={handleChange} form={form} />}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <FloatingActionButton
        isShown={isFormValid()}
        onClick={handleCreate}
        disabled={isLoading || !isFormValid()}
        ariaLabel={lang('Create')}
        iconName="check"
        isLoading={isLoading}
      />
    </form>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const integrationId = selectTelebizSelectedIntegrationId(global);
    return {
      properties: integrationId ? selectTelebizProperties(global, integrationId) : [],
    };
  },
)(CreatePageForm));
