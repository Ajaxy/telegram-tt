import type { FC } from '../../../../lib/teact/teact';
import { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { Integration, Organization } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectUser } from '../../../../global/selectors';
import {
  selectCurrentTelebizOrganization,
  selectTelebizSelectedIntegration,
  selectTelebizSelectedIntegrationId,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { type CreateProviderEntityData, ProviderEntityType } from '../../../services';
import { telebizApiClient } from '../../../services';

import useLastCallback from '../../../../hooks/useLastCallback';

import CreateCompanyForm from './CreateEntityForm/CreateCompanyForm';
import CreateContactForm from './CreateEntityForm/CreateContactForm';
import CreateDealForm from './CreateEntityForm/CreateDealForm';
import CreatePageForm from './CreateEntityForm/CreatePageForm';
import RelationshipLinkView from './RelationshipLinkView';

import styles from './TelebizAddRelationship.module.scss';

interface OwnProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  chatId: string;
  entityType: ProviderEntityType;
}

type StateProps = {
  currentOrganization?: Organization;
  selectedIntegrationId?: number;
  selectedIntegration?: Integration;
};

const CreateEntity: FC<OwnProps & StateProps> = ({
  searchQuery,
  setSearchQuery,
  chatId,
  entityType,
  currentOrganization,
  selectedIntegrationId,
  selectedIntegration,
}) => {
  const {
    openTelebizPanelScreen,
    setTelebizIsAddingRelationship,
    addTelebizRelationship,
  } = getActions();

  useEffect(() => {
    if (!selectedIntegrationId || !chatId) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [selectedIntegrationId, openTelebizPanelScreen, chatId]);

  const handleCreate = useLastCallback(async (formData: Partial<CreateProviderEntityData>) => {
    const global = getGlobal();
    const user = chatId ? selectUser(global, chatId) : undefined;
    const telegramHandle = user?.usernames?.find((x) => x.isActive)?.username;

    const createData: CreateProviderEntityData = {
      ...formData,
      telegramHandle,
      entityType,
      integrationId: selectedIntegrationId!,
      telegramId: chatId,
      organizationId: currentOrganization?.id,
    };

    try {
      // Create the entity
      const entity = await telebizApiClient.integrations.createProviderEntity(createData);
      if (!entity || !selectedIntegrationId) return;

      // Add sync timestamp
      entity.lastSyncAt = Date.now();

      // Link entity to chat
      const relationship = await telebizApiClient.integrations.linkEntity({
        integrationId: selectedIntegrationId,
        telegramId: chatId,
        telegramHandle,
        entityType,
        entityId: entity.id,
        organizationId: currentOrganization?.id,
      });

      // Add relationship AND entity to state
      addTelebizRelationship({ relationship, entity });

      setTelebizIsAddingRelationship({ isAdding: false });
      setSearchQuery('');
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  });

  const renderForm = useLastCallback(() => {
    switch (entityType) {
      case ProviderEntityType.Page:
        return <CreatePageForm initialTitle={searchQuery} onCreate={handleCreate} />;
      case ProviderEntityType.Deal:
        return <CreateDealForm initialTitle={searchQuery} onCreate={handleCreate} />;
      case ProviderEntityType.Contact:
        return <CreateContactForm initialName={searchQuery} onCreate={handleCreate} />;
      case ProviderEntityType.Company:
        return <CreateCompanyForm initialName={searchQuery} onCreate={handleCreate} />;
      default:
        return undefined;
    }
  });

  return (
    <div className={styles.container}>
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        <RelationshipLinkView chatId={chatId} integration={selectedIntegration}>
          {renderForm()}
        </RelationshipLinkView>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    currentOrganization: selectCurrentTelebizOrganization(global),
    selectedIntegrationId: selectTelebizSelectedIntegrationId(global),
    selectedIntegration: selectTelebizSelectedIntegration(global),
  }),
)(CreateEntity));
