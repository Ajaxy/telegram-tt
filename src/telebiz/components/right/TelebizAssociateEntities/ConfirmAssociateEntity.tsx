import { memo, useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, getPromiseActions, withGlobal } from '../../../../global';

import type {
  ProviderEntity,
  ProviderEntityType,
  ProviderRelationship,
} from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import { selectTelebizEntity, selectTelebizSelectedRelationship } from '../../../global/selectors';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../components/ui/FloatingActionButton';
import RelationshipLinkView from '../TelebizAddRelationship/RelationshipLinkView';
import EntityDetails from '../TelebizAddRelationship/RelationshipLinkView/EntityDetails';

import styles from '../TelebizAddRelationship/TelebizAddRelationship.module.scss';

interface OwnProps {
  entity: ProviderEntity;
  setSearchQuery: (query: string) => void;
  entityType: ProviderEntityType;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  parentEntity?: ProviderEntity;
};

const ConfirmAssociateEntity = ({
  entity,
  setSearchQuery,
  entityType,
  selectedRelationship,
  parentEntity,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen } = getActions();

  const [isLoading, setIsLoading] = useState(false);

  const lang = useTelebizLang();

  useEffect(() => {
    if (!entity) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [entity, openTelebizPanelScreen]);

  const onSave = useCallback(async () => {
    if (!entity || !selectedRelationship) return;

    setIsLoading(true);
    await getPromiseActions().associateTelebizEntity({
      integrationId: selectedRelationship.integration_id,
      entityType,
      entityId: entity.id,
      associatedEntityType: selectedRelationship.entity_type,
      associatedEntityId: selectedRelationship.entity_id,
    });

    setSearchQuery('');
    openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    setIsLoading(false);
  }, [entity,
    selectedRelationship,
    entityType,
    setSearchQuery,
    openTelebizPanelScreen,
  ]);

  if (!entity) {
    return undefined;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <RelationshipLinkView parentEntity={parentEntity} parentEntityType={selectedRelationship?.entity_type}>
          <EntityDetails entity={entity} entityType={entityType} />
        </RelationshipLinkView>
      </div>
      <FloatingActionButton
        isShown
        onClick={onSave}
        disabled={isLoading}
        ariaLabel={lang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    let parentEntity: ProviderEntity | undefined;
    if (selectedRelationship) {
      parentEntity = selectTelebizEntity(
        global,
        selectedRelationship.integration_id,
        selectedRelationship.entity_type,
        selectedRelationship.entity_id,
      );
    }

    return {
      selectedRelationship,
      parentEntity,
    };
  },
)(ConfirmAssociateEntity));
