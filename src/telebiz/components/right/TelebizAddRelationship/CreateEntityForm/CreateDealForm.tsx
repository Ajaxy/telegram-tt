import { memo, useCallback, useEffect, useRef, useState } from '../../../../../lib/teact/teact';
import { withGlobal } from '../../../../../global';

import type {
  Property,
  PropertyOption } from '../../../../services';

import { selectTelebizPropertiesByEntityType, selectTelebizSelectedIntegrationId } from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { disableDirectTextInput, enableDirectTextInput } from '../../../../../util/directInputManager';
import {
  ProviderEntityType } from '../../../../services';
import {
  type CreateProviderEntityData,
} from '../../../../services';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';
import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import InputText from '../../../../../components/ui/InputText';
import Select from '../../../../../components/ui/Select';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  initialTitle: string;
  integrationId?: number;
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  error?: string;
}

type StateProps = {
  properties: Property[];
};

const CreateDealForm = ({
  initialTitle,
  onCreate,
  error,
  properties,
}: OwnProps & StateProps) => {
  const { getPropertyOptions, getPropertyLabel } = useProviderProperty(properties);
  const pipelineOptions = getPropertyOptions('pipeline') as PropertyOption[];
  const stageOptions = getPropertyOptions('stage') as Record<string, PropertyOption[]>;
  const titleRef = useRef<HTMLInputElement | undefined>(undefined);

  const [title, setTitle] = useState(initialTitle);
  const [selectedPipeline, setSelectedPipeline] = useState<PropertyOption | undefined>(undefined);
  const [selectedStage, setSelectedStage] = useState<PropertyOption | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const lang = useTelebizLang();

  useEffect(() => {
    if (pipelineOptions?.length && !selectedPipeline) {
      setSelectedPipeline(pipelineOptions[0]);
      setSelectedStage(stageOptions[pipelineOptions[0].value][0]);
    }
  }, [pipelineOptions, stageOptions, selectedPipeline, selectedStage]);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus();
    }
  }, [titleRef]);

  const clearForm = useCallback(() => {
    setTitle('');
    setSelectedPipeline(undefined);
    setSelectedStage(undefined);
  }, []);

  const isFormValid = useCallback(() => {
    return title.length > 0;
  }, [title]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid()) return;
    setIsLoading(true);
    try {
      const createData: Partial<CreateProviderEntityData> = {
        title,
        pipelineId: selectedPipeline?.value,
        stage: selectedStage?.value,
      };

      await onCreate(createData);
      clearForm();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isFormValid, title, selectedPipeline, selectedStage, onCreate, clearForm]);

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
        <InputText
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          label={getPropertyLabel('title')}
          className={buildClassName(styles.formField, 'input-group')}
          ref={titleRef}
        />
        <div className={styles.formField}>
          <Select
            id="pipeline"
            value={selectedPipeline?.value || ''}
            onChange={(e) => {
              const pipeline = pipelineOptions.find((p) => p.value === e.target.value);
              setSelectedPipeline(pipeline);
              setSelectedStage(stageOptions[pipeline?.value || ''][0]);
            }}
            label={getPropertyLabel('pipeline')}
            hasArrow={Boolean(true)}
          >
            {pipelineOptions.map((pipeline) => (
              <option key={pipeline.value} value={pipeline.value}>
                {pipeline.label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.formField}>
          <Select
            id="stage"
            value={selectedStage?.value || ''}
            onChange={(e) => {
              const stage = stageOptions[selectedPipeline?.value || '']?.find((s) => s.value === e.target.value);
              setSelectedStage(stage);
            }}
            label={getPropertyLabel('stage')}
            hasArrow={Boolean(true)}
          >
            {stageOptions[selectedPipeline?.value || '']?.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <FloatingActionButton
        isShown={title.length > 0}
        onClick={handleCreate}
        disabled={isLoading || !title}
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
      selectTelebizPropertiesByEntityType(global, integrationId, ProviderEntityType.Deal) : [];

    return {
      properties,
    };
  },
)(CreateDealForm));
