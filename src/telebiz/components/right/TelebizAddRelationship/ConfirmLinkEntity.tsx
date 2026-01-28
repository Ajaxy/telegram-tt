import type { FC } from '../../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiUser } from '../../../../api/types';
import type { Integration, Organization, ProviderEntity, ProviderEntityType } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { getMainUsername } from '../../../../global/helpers';
import { selectUser } from '../../../../global/selectors';
import {
  selectCurrentTelebizOrganization,
  selectTelebizSelectedIntegration,
  selectTelebizSelectedIntegrationId,
} from '../../../global/selectors';
import { isUserId } from '../../../../util/entities/ids';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../components/ui/FloatingActionButton';
import RelationshipLinkView from './RelationshipLinkView';
import EntityDetails from './RelationshipLinkView/EntityDetails';

import styles from './TelebizAddRelationship.module.scss';

interface OwnProps {
  entity: ProviderEntity;
  entityType: ProviderEntityType;
  chatId: string;
  setSearchQuery: (query: string) => void;
}

type StateProps = {
  currentOrganization?: Organization;
  selectedIntegrationId?: number;
  selectedIntegration?: Integration;
  user?: ApiUser;
};

const ConfirmLinkEntity: FC<OwnProps & StateProps> = ({
  entity,
  entityType,
  chatId,
  setSearchQuery,
  currentOrganization,
  selectedIntegrationId,
  selectedIntegration,
  user,
}) => {
  const {
    openTelebizPanelScreen,
    setTelebizIsAddingRelationship,
    linkTelebizEntity,
  } = getActions();

  const [isLoading, setIsLoading] = useState(false);

  const lang = useTelebizLang();

  useEffect(() => {
    if (!entity) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [entity, openTelebizPanelScreen]);

  const onSave = useLastCallback(() => {
    if (!entity || !selectedIntegrationId) return;

    setIsLoading(true);
    try {
      linkTelebizEntity({
        integrationId: selectedIntegrationId,
        telegramId: chatId,
        telegramHandle: user ? getMainUsername(user) : undefined,
        organizationId: currentOrganization?.id,
        entityType,
        entityId: entity.id,
      });

      setSearchQuery('');
      setTelebizIsAddingRelationship({ isAdding: false });
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    } finally {
      setIsLoading(false);
    }
  });

  if (!entity) {
    return undefined;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <RelationshipLinkView chatId={chatId} integration={selectedIntegration}>
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
  (global, { chatId }): StateProps => ({
    currentOrganization: selectCurrentTelebizOrganization(global),
    selectedIntegrationId: selectTelebizSelectedIntegrationId(global),
    selectedIntegration: selectTelebizSelectedIntegration(global),
    user: isUserId(chatId) ? selectUser(global, chatId) : undefined,
  }),
)(ConfirmLinkEntity));
