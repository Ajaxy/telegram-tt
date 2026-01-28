import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessage } from '../../../../api/types';
import type { Integration, ProviderRelationship, Reminder } from '../../../services';

import { selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectTelebizIntegrationsList,
  selectTelebizIsAddingRelationship,
  selectTelebizProperties,
  selectTelebizReminderForMessage,
  selectTelebizSelectedIntegrationId,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';

import MenuItem from '../../../../components/ui/MenuItem';
import MenuSeparator from '../../../../components/ui/MenuSeparator';
import NestedMenuItem from '../../../../components/ui/NestedMenuItem';
import LogoE from '../../icons/LogoE';
import TelebizAddRelationshipMenu from '../../right/TelebizAddRelationshipMenu';

interface OwnProps {
  message: ApiMessage;
  onClose: () => void;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  isAddingRelationship: boolean;
  selectedIntegrationId?: number;
  integrations: Integration[];
  properties: any[];
  reminder?: Reminder;
};

const TelebizMenuItem = ({
  message,
  onClose,
  reminder,
  selectedRelationship,
  isAddingRelationship,
  selectedIntegrationId,
  integrations,
  properties,
}: OwnProps & StateProps) => {
  const { openTelebizReminderModal } = getActions();

  return (
    <>
      <NestedMenuItem
        customIcon={<i className="icon icon-telebiz"><LogoE /></i>}
        submenu={(
          <>
            <MenuItem
              icon="timer"
              onClick={() => {
                openTelebizReminderModal({
                  message: { chatId: message.chatId, id: message.id },
                  reminder,
                });
              }}
            >
              {reminder ? 'Manage Reminder' : 'Add Reminder'}
            </MenuItem>

            {selectedRelationship && (
              <TelebizAddRelationshipMenu
                selectedRelationship={selectedRelationship}
                isAddingRelationship={isAddingRelationship}
                selectedIntegrationId={selectedIntegrationId}
                integrations={integrations}
                properties={properties}
                isOpen
                onClose={onClose}
                onlyItems
                data={{
                  text: message.content.text?.text || '',
                  messageId: message.id.toString(),
                  chatId: message.chatId.toString(),
                }}
              />
            )}
          </>
        )}
      >
        Telebiz
      </NestedMenuItem>
      <MenuSeparator size="thin" />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedIntegrationId = selectTelebizSelectedIntegrationId(global);

    return {
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
      isAddingRelationship: selectTelebizIsAddingRelationship(global),
      selectedIntegrationId,
      integrations: selectTelebizIntegrationsList(global),
      properties: selectedIntegrationId ? selectTelebizProperties(global, selectedIntegrationId) : [],
      reminder: selectTelebizReminderForMessage(global, message.chatId, message.id),
    };
  },
)(TelebizMenuItem));
