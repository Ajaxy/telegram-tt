import { memo, useCallback, useEffect, useMemo, useRef, useState } from '@teact';
import { withGlobal } from '../../../../../global';

import type { Property, PropertyOption } from '../../../../services';

import { selectTelebizPropertiesByEntityType, selectTelebizSelectedIntegrationId } from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { disableDirectTextInput, enableDirectTextInput } from '../../../../../util/directInputManager';
import { type CreateProviderEntityData, ProviderEntityType } from '../../../../services';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';
import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import InputText from '../../../../../components/ui/InputText';
import Select from '../../../../../components/ui/Select';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  initialName: string;
  integrationId?: number;
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  error?: string;
}
interface StateProps {
  properties: Property[];
}

const CreateCompanyForm = ({
  initialName,
  onCreate,
  error,
  properties,
}: OwnProps & StateProps) => {
  const { getPropertyOptions, getPropertyLabel } = useProviderProperty(properties);
  const nameRef = useRef<HTMLInputElement | undefined>(undefined);

  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const lang = useTelebizLang();

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (nameRef.current) {
      nameRef.current.focus();
    }
  }, [nameRef]);

  const industryOptions = useMemo(() => getPropertyOptions('industry'), [getPropertyOptions]) as PropertyOption[];
  const typeOptions = useMemo(() => getPropertyOptions('type'), [getPropertyOptions]) as PropertyOption[];

  useEffect(() => {
    if (selectedIndustry || selectedType) return;
    setSelectedIndustry(industryOptions.length > 0 ? industryOptions[0].value : undefined);
    setSelectedType(typeOptions.length > 0 ? typeOptions[0].value : undefined);
  }, [industryOptions, typeOptions, selectedIndustry, selectedType]);

  const clearForm = useCallback(() => {
    setName('');
    setWebsite('');
    setSelectedIndustry(undefined);
    setSelectedType(undefined);
  }, []);

  const isFormValid = useCallback(() => {
    return name.length > 0;
  }, [name]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid()) return;
    setIsLoading(true);
    try {
      const createData: Partial<CreateProviderEntityData> = {
        name,
        website,
        ...(selectedIndustry ? { industry: selectedIndustry } : {}),
        ...(selectedType ? { type: selectedType } : {}),
      };
      await onCreate(createData);
      clearForm();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [name, website, selectedIndustry, selectedType, onCreate, clearForm, isFormValid, setIsLoading]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
      onFocus={() => disableDirectTextInput()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          enableDirectTextInput();
        }
      }}
    >
      <div className={styles.formContent}>
        <InputText
          value={name}
          onChange={(e) => setName(e.target.value)}
          label={getPropertyLabel('name')}
          className={buildClassName(styles.formField, 'input-group')}
          ref={nameRef}
        />
        <InputText
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          label={getPropertyLabel('website')}
          className={buildClassName(styles.formField, 'input-group')}
        />
        <div className={styles.formField}>
          <Select
            id="industry"
            value={selectedIndustry || ''}
            onChange={(e) => {
              setSelectedIndustry(e.target.value);
            }}
            label={getPropertyLabel('industry')}
            hasArrow={Boolean(true)}
          >
            {industryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {typeOptions.length > 0 && (
          <div className={styles.formField}>
            <Select
              id="type"
              value={selectedType || ''}
              onChange={(e) => {
                setSelectedType(e.target.value);
              }}
              label={getPropertyLabel('type')}
              hasArrow={Boolean(true)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <FloatingActionButton
        isShown={name.length > 0}
        onClick={handleCreate}
        disabled={isLoading || !name}
        ariaLabel={lang('Create')}
        iconName="check"
        isLoading={isLoading}
      />
    </form>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const integrationId = ownProps.integrationId ?? selectTelebizSelectedIntegrationId(global);
    const properties = integrationId ?
      selectTelebizPropertiesByEntityType(global, integrationId, ProviderEntityType.Company) : [];
    return {
      properties,
    };
  },
)(CreateCompanyForm),
);
