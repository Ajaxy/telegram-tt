import { memo, useMemo, useState } from '@teact';

import type { PropertiesByEntityType, ProviderEntity, ProviderPage } from '../../../services/types';
import type { FormField } from '../../common/ProviderEntityForm/forms';
import { ProviderEntityType } from '../../../services/types';

import { convertFormFieldsToNotionProperties } from '../../../util/notion';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import EntityForm from '../../common/ProviderEntityForm/ProviderEntityForm';

import styles from './TelebizRelationshipModal.module.scss';

interface TelebizRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void | Promise<void>;
  entity?: Partial<ProviderEntity>;
  creating: boolean;
  type: ProviderEntityType;
  provider: string;
  properties: PropertiesByEntityType[];
}

const TelebizRelationshipModal = ({
  isOpen,
  onClose,
  onSubmit,
  entity,
  creating,
  type,
  provider,
  properties,
}: TelebizRelationshipModalProps) => {
  const lang = useTelebizLang();
  const [isLoading, setIsLoading] = useState(false);

  const formTitle = useMemo(() => {
    return creating
      ? lang('RelationshipModal.AddTitle', { entity: type })
      : lang('RelationshipModal.EditTitle', { entity: type });
  }, [creating, lang, type]);

  const handleSubmit = async (form: Record<string, FormField>) => {
    setIsLoading(true);

    // If editing a Page, we need to structure the update correctly for Notion
    if (type === ProviderEntityType.Page && !creating && entity) {
      const props = properties.find((p) => p.id === (entity as ProviderPage).parent?.database_id)?.properties;
      const notionPayload = convertFormFieldsToNotionProperties(form, props || []);
      await onSubmit({ properties: notionPayload });
    } else {
      const _form = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.value]));
      await onSubmit(_form);
    }
    setIsLoading(false);
  };

  return (
    <Modal
      className={styles.modal}
      isOpen={isOpen}
      onClose={() => {
        onClose();
      }}
      contentClassName={styles.modalContent}
      title={formTitle}
      hasCloseButton
      isSlim
    >
      <EntityForm
        provider={provider}
        entityType={type}
        entity={entity}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        properties={properties}
        renderSubmitButton={(props) => (
          <div className={styles.footer}>
            <div className={styles.footerButtons}>
              <Button
                type="submit"
                {...props}
              >
                {lang('RelationshipModal.Save')}
              </Button>
            </div>
          </div>
        )}
      />
    </Modal>
  );
};

export default memo(TelebizRelationshipModal);
