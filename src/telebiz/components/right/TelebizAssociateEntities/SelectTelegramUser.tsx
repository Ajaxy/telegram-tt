import { memo, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChatMember } from '../../../../api/types';
import type { Organization, ProviderContact, ProviderEntity, ProviderRelationship } from '../../../services/types';
import { ProviderEntityType } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectChatFullInfo, selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectAllTelebizRelationships,
  selectCurrentTelebizOrganization,
  selectTelebizEntity,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import PeerPicker from '../../../../components/common/pickers/PeerPicker';

import styles from '../TelebizAddRelationship/TelebizAddRelationship.module.scss';

interface OwnProps {
  onUserSelected: (userId: string) => void;
  chatId: string;
  selectedContact: ProviderContact;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedEntity?: ProviderEntity;
  currentOrganization?: Organization;
  chatMembers?: ApiChatMember[];
};

const SelectTelegramUser = ({
  onUserSelected,
  selectedContact,
  relationshipsList,
  selectedEntity,
  currentOrganization,
  chatMembers,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen } = getActions();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedContact) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [selectedContact, openTelebizPanelScreen]);

  if (!selectedEntity) return undefined;

  const contacts = selectedEntity.associations?.contacts as ProviderContact[];
  const linkedUserIds = useMemo(() => (contacts ?? []).map((contact) =>
    relationshipsList.filter((relationship) =>
      relationship.entity_id === contact.id && relationship.entity_type === ProviderEntityType.Contact,
    ).map((relationship) => relationship.telegram_id)).flat(), [contacts, relationshipsList]);

  const handleSelectedUserIdsChange = useLastCallback((userId: string) => {
    setSelectedUserId(userId);
    onUserSelected(userId);
  });

  const chatUsers = chatMembers?.map((member) => member.userId);
  const externalUsers = chatUsers?.filter((userId) =>
    !currentOrganization?.members?.find((member) => member.telegram_id === userId));
  const unlinkedUsers = externalUsers?.filter((userId) => !linkedUserIds.includes(userId));

  return (
    <div className={buildClassName(styles.linkTelegramUser, 'custom-scroll')}>
      <PeerPicker
        itemIds={unlinkedUsers || []}
        onSelectedIdChange={handleSelectedUserIdsChange}
        selectedId={selectedUserId}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = currentChatId ? selectTelebizSelectedRelationship(global, currentChatId) : undefined;
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    let selectedEntity: ProviderEntity | undefined;
    if (selectedRelationship) {
      selectedEntity = selectTelebizEntity(
        global,
        selectedRelationship.integration_id,
        selectedRelationship.entity_type,
        selectedRelationship.entity_id,
      );
    }

    return {
      relationshipsList: selectAllTelebizRelationships(global),
      selectedEntity,
      currentOrganization: selectCurrentTelebizOrganization(global),
      chatMembers: chatFullInfo?.members,
    };
  },
)(SelectTelegramUser));
