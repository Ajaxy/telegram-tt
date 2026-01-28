// Telebiz Configuration Constants

import { ProviderEntityTab, ProviderEntityType } from '../services';

export const TELEBIZ_CONTACT_URL = 'https://telebiz.io';
export const TELEBIZ_WEBSITE_URL = 'https://telebiz.io';
export const TELEBIZ_PRIVACY_URL = 'https://telebiz.io/privacy/';
export const TELEBIZ_FAQ_URL = 'https://telebiz.io/#faq';
export const TELEBIZ_TERMS_URL = 'https://telebiz.io/terms/';

// Bot usernames
export const TELEBIZ_AUTH_BOT_USERNAME = 'telebiz_auth_bot';
export const TELEBIZ_TEMPLATES_BOT_USERNAME = 'telebiz_templates_bot';
export const TELEBIZ_ANALYTICS_BOT_USERNAME = 'telebiz_analytics_bot';

export const PROVIDER_TYPE_TO_TAB_MAP = {
  [ProviderEntityType.Deal]: ProviderEntityTab.Deals,
  [ProviderEntityType.Meeting]: ProviderEntityTab.Meetings,
  [ProviderEntityType.Contact]: ProviderEntityTab.Contacts,
  [ProviderEntityType.Task]: ProviderEntityTab.Tasks,
  [ProviderEntityType.Note]: ProviderEntityTab.Notes,
  [ProviderEntityType.Page]: ProviderEntityTab.Pages,
  [ProviderEntityType.Company]: ProviderEntityTab.Companies,
  [ProviderEntityType.Organization]: undefined,
};

// Re-export storage keys from separate file to avoid circular dependencies
export { TelebizStorageKey } from './storageKeys';

export const ENTITIES_SYNC_THRESHOLD = 1000 * 60 * 5; // 5 minutes
export const PIPELINES_SYNC_THRESHOLD = 1000 * 60 * 10; // 10 minutes
export const PROPERTIES_SYNC_THRESHOLD = 1000 * 60 * 10; // 10 minutes

// Notification IDs
export const TELEBIZ_ERROR_NOTIFICATION_ID = 'telebiz-error';

// Organization Roles
export const ORGANIZATION_OWNER_ROLE = 'org_owner';
export const ORGANIZATION_ADMIN_ROLE = 'org_admin';
export const ORGANIZATION_MEMBER_ROLE = 'org_member';
export const ORGANIZATION_MANAGER_ROLES = [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE];
