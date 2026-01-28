import type { ActionReturnType } from '../../../../global/types';

import { addActionHandler } from '../../../../global/index';
import { updateTabState } from '../../../../global/reducers/tabs';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';

// Relationship Entity Modal
addActionHandler('openTelebizEntityModal', (global, _actions, payload): ActionReturnType => {
  const { type, entity, isExisting, canRemove } = payload;
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    relationshipModal: {
      type,
      entity,
      isExisting,
      canRemove,
      isOpen: true,
    },
  }, tabId);
});

addActionHandler('closeTelebizEntityModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    relationshipModal: undefined,
  }, tabId);
});

// Confirm Delete Dialog
addActionHandler('openTelebizConfirmDeleteDialog', (global, _actions, payload): ActionReturnType => {
  const { entityId, entityType } = payload;
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    deleteEntityDialog: {
      entityId,
      entityType,
      isOpen: true,
    },
  }, tabId);
});

addActionHandler('closeTelebizConfirmDeleteDialog', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    deleteEntityDialog: undefined,
  }, tabId);
});

// Remove Entity From Chat Dialog
addActionHandler('openTelebizRemoveEntityFromChatDialog', (global, _actions, payload): ActionReturnType => {
  const { title } = payload;
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    removeEntityFromChatDialog: {
      isOpen: true,
      title,
    },
  }, tabId);
});

addActionHandler('closeTelebizRemoveEntityFromChatDialog', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    removeEntityFromChatDialog: undefined,
  }, tabId);
});

// Reminder Modal
addActionHandler('openTelebizReminderModal', (global, _actions, payload): ActionReturnType => {
  const { message, reminder } = payload;
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    reminderModal: {
      message,
      reminder,
      isOpen: true,
    },
  }, tabId);
});

addActionHandler('closeTelebizReminderModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    reminderModal: undefined,
  }, tabId);
});

// Agent Enable Modal
addActionHandler('openTelebizEnableAgentModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    enableAgentModal: {
      isOpen: true,
      hasAcceptedRisk: false,
    },
  }, tabId);
});

addActionHandler('closeTelebizEnableAgentModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    enableAgentModal: {
      isOpen: false,
      hasAcceptedRisk: false,
    },
  }, tabId);
});

// Templates Chats Modal
addActionHandler('openTelebizTemplatesChatsModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    isTemplatesChatsModalOpen: true,
  }, tabId);
});

addActionHandler('closeTelebizTemplatesChatsModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    isTemplatesChatsModalOpen: false,
  }, tabId);
});

// Features Modal
addActionHandler('telebizOpenFeaturesModal', (global, _actions, payload): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    featuresModal: {
      isOpen: true,
      section: payload?.section,
    },
  }, tabId);
});

addActionHandler('telebizCloseFeaturesModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    featuresModal: undefined,
  }, tabId);
});

// Skills Modal
addActionHandler('openSkillsModal', (global, _actions, payload): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    skillsModal: {
      isOpen: true,
      editingItem: payload?.editingItem,
    },
  }, tabId);
});

addActionHandler('closeSkillsModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();
  return updateTabState(global, {
    skillsModal: undefined,
  }, tabId);
});
