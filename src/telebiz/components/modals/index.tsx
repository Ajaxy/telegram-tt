import ConfirmAgentModal from './ConfirmAgentModal/ConfirmAgentModalContainer';
import ConfirmDeleteDialog from './ConfirmRelationshipEntityDeleteDialog/ConfirmDeleteDialogContainer';
import RemoveEntityFromChatDialog from './RemoveEntityFromChatDialog/RemoveEntityFromChatDialogContainer';
import TelebizFeaturesModal from './TelebizFeaturesModal/TelebizFeaturesModalContainer';
import TelebizRelationshipModal from './TelebizRelationshipModal/TelebizRelationshipModalContainer';
import TelebizReminderModal from './TelebizReminderModal/TelebizReminderModalContainer';
import TelebizTemplatesChatsModal from './TelebizTemplatesChatsModal/TelebizTemplatesChatModalContainer';
import TelebizWelcomeModal from './TelebizWelcomeModal/TelebizWelcomeModalContainer';

const TelebizModals = () => {
  return (
    <>
      <TelebizWelcomeModal />
      <TelebizFeaturesModal />
      <TelebizRelationshipModal />
      <TelebizReminderModal />
      <TelebizTemplatesChatsModal />
      <ConfirmAgentModal />
      <ConfirmDeleteDialog />
      <RemoveEntityFromChatDialog />
    </>
  );
};

export default TelebizModals;
