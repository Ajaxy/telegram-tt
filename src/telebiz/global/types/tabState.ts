import type { Skill } from '../../agent/types';
import type { TelebizPanelScreens } from '../../components/right/types';
import type { ProviderEntity, ProviderEntityType, Reminder } from '../../services/types';
import type { TelebizFeatureSection } from './telebizState';

export interface TelebizRelationshipModal {
  entity?: Partial<ProviderEntity>;
  type?: ProviderEntityType;
  isOpen: boolean;
  isExisting?: boolean;
  canRemove?: boolean;
}

export interface TelebizDeleteEntityDialog {
  entityId?: string;
  entityType?: ProviderEntityType;
  isOpen: boolean;
}

export interface TelebizReminderModal {
  isOpen: boolean;
  message?: { chatId: string; id: number };
  reminder?: Reminder;
}

export interface TelebizEnableAgentModal {
  isOpen: boolean;
  hasAcceptedRisk?: boolean;
}

export interface TelebizRemoveEntityFromChatDialog {
  isOpen: boolean;
  title?: string;
}

export interface TelebizFeaturesModal {
  isOpen: boolean;
  section?: TelebizFeatureSection;
}

export interface TelebizSkillsModal {
  isOpen: boolean;
  editingItem?: Skill;
}

export interface TelebizTabStateFields {
  isTelebizPanelOpen?: boolean;
  telebizPanelScreen?: TelebizPanelScreens;
  relationshipModal?: TelebizRelationshipModal;
  deleteEntityDialog?: TelebizDeleteEntityDialog;
  removeEntityFromChatDialog?: TelebizRemoveEntityFromChatDialog;
  reminderModal?: TelebizReminderModal;
  enableAgentModal?: TelebizEnableAgentModal;
  isTemplatesChatsModalOpen?: boolean;
  featuresModal?: TelebizFeaturesModal;
  skillsModal?: TelebizSkillsModal;
}
