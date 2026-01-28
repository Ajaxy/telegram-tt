import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ProviderEntity, ProviderEntityType, ProviderRelationship } from '../../services/types';

import { selectCurrentMessageList } from '../../../global/selectors';
import {
  selectTelebizAuthIsLoading,
  selectTelebizIntegrationsIsLoading,
  selectTelebizIsAddingRelationship,
  selectTelebizOrganizationsIsLoading,
  selectTelebizSelectedRelationship,
} from '../../global/selectors';
import { selectIsTelebizTemplatesChat } from '../../global/selectors/templatesChats';

import Loading from '../../../components/ui/Loading';
import TelebizAddRelationship from './TelebizAddRelationship';
import TelebizBulkSend from './TelebizBulkSend';
import TelebizRelationship from './TelebizRelationship';

interface OwnProps {
  chatId?: string;
  isMobile?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSelectedEntity: (entity: ProviderEntity, entityType: ProviderEntityType) => void;
  setSelectedEntityType: (entityType: ProviderEntityType) => void;
  selectedEntityType: ProviderEntityType;
}

type StateProps = {
  isAuthLoading: boolean;
  isLoadingIntegrations: boolean;
  isLoadingOrganizations: boolean;
  selectedRelationship?: ProviderRelationship;
  isAddingRelationship?: boolean;
  isTemplatesChat?: boolean;
};

const TelebizPanelMain = ({
  chatId,
  isMobile,
  searchQuery,
  setSearchQuery,
  setSelectedEntity,
  setSelectedEntityType,
  selectedEntityType,
  isAuthLoading,
  isLoadingIntegrations,
  isLoadingOrganizations,
  selectedRelationship,
  isAddingRelationship,
  isTemplatesChat,
}: OwnProps & StateProps) => {
  if (
    isAuthLoading
    || isLoadingIntegrations
    || isLoadingOrganizations
    || !selectedEntityType
  ) {
    return <Loading />;
  }

  // Show bulk send UI directly for templates chats
  if (isTemplatesChat && chatId) {
    return <TelebizBulkSend chatId={chatId} />;
  }

  if (!selectedRelationship || isAddingRelationship) {
    return (
      <TelebizAddRelationship
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setSelectedEntity={setSelectedEntity}
        setSelectedEntityType={setSelectedEntityType}
        selectedEntityType={selectedEntityType}
      />
    );
  }

  return (
    <TelebizRelationship
      isMobile={isMobile}
      onEntitySelected={setSelectedEntity}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId
      ? selectTelebizSelectedRelationship(global, chatId)
      : undefined;
    const isTemplatesChat = chatId
      ? selectIsTelebizTemplatesChat(global, chatId)
      : false;

    return {
      isAuthLoading: selectTelebizAuthIsLoading(global),
      isLoadingIntegrations: selectTelebizIntegrationsIsLoading(global),
      isLoadingOrganizations: selectTelebizOrganizationsIsLoading(global),
      selectedRelationship,
      isAddingRelationship: selectTelebizIsAddingRelationship(global),
      isTemplatesChat,
    };
  },
)(TelebizPanelMain));
