// Base API Response Structure
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  integrations?: T[];
  events?: T[];
  entities?: T[];
  organizations?: T[];
  members?: T[];
  invitations?: T[];
  teams?: T[];
  roles?: T[];
  webhooks?: T[];
  reminders?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ResponseWithTotal<T = any> {
  notifications?: T[];
  total: number;
}

// User Types
export interface TelebizUser {
  id: number;
  telegram_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelebizAuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: TelebizUser;
}

// Error Types
export interface TelebizApiError {
  message: string;
  code: string;
  status: number;
}

export type ProviderEntityAssociations = 'contacts' | 'deals' | 'meetings' | 'notes' | 'tasks' | 'companies';

export interface ProviderEntityBase {
  id: string;
  relationship?: ProviderRelationship;
  activities?: ProviderActivity[];
  metadata?: {
    organization?: {
      id?: string;
      name?: string;
    };
    person?: {
      id?: string;
      name?: string;
    };
    owner?: ProviderItemOwner;
    activities?: ProviderActivity[];
    [key: string]: any;
  };
  owner?: {
    id?: string;
    name?: string;
  };
  associations?: {
    contacts?: ProviderContact[];
    deals?: ProviderDeal[];
    meetings?: ProviderMeeting[];
    notes?: ProviderNote[];
    tasks?: ProviderTask[];
    companies?: ProviderCompany[];
  };
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: number;
}

// Provider Types
export interface ProviderContact extends ProviderEntityBase {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  provider: string;
  lastContact?: string;
  deals?: ProviderDeal[];
  jobTitle?: string;
  lifecyclestage?: string;
}

export interface ProviderDeal extends ProviderEntityBase {
  title: string;
  amount: number;
  status: string;
  currency: string;
  pipeline: string;
  stage: string;
  closeDate: string;
  timeInStage?: number;
  source?: string;
  probability?: number;
}

export interface ProviderCompany extends ProviderEntityBase {
  name: string;
  country?: string;
  city?: string;
  website?: string;
  industry?: string;
  size?: string;
  employees?: number;
  location?: string;
  description?: string;
  phone?: string;
  email?: string;
  lifecyclestage?: string;
  type?: string;
}

export interface ProviderMeeting extends ProviderEntityBase {
  title: string;
  startDate: string;
  description: string;
  owner?: ProviderItemOwner;
  externalUrl?: string;
  location?: string;
  attendees?: string[];
  status: ProviderMeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderNote extends ProviderEntityBase {
  body: string;
  owner?: ProviderItemOwner;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderTask extends ProviderEntityBase {
  date: string;
  subject?: string;
  body?: string;
  status: 'COMPLETED' | 'NOT_STARTED';
  taskType: 'EMAIL' | 'CALL' | 'TODO';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'NONE';
  owner?: ProviderItemOwner;
  createdAt: string;
  updatedAt: string;
}

// Notion Types
export interface NotionProperty {
  id: string;
  type: string;
  [key: string]: any;
}

export interface NotionRichText {
  type: string;
  text?: {
    content: string;
    link?: any;
  };
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string | null;
}

export interface NotionBlock {
  object: string;
  id: string;
  parent?: any;
  created_time: string;
  last_edited_time: string;
  created_by?: any;
  last_edited_by?: any;
  has_children: boolean;
  archived: boolean;
  in_trash?: boolean;
  type: string;
  [key: string]: any;
}

export interface NotionHeading {
  rich_text: NotionRichText[];
  is_toggleable: boolean;
  color: string;
}

export interface NotionParagraph {
  rich_text: NotionRichText[];
  color: string;
}

export interface NotionToDo {
  rich_text: NotionRichText[];
  checked: boolean;
  color: string;
}

export interface ProviderPage extends ProviderEntityBase {
  url: string;
  publicUrl?: string | null;
  properties: Record<string, NotionProperty>;
  archived: boolean;
  inTrash?: boolean;
  isLocked?: boolean;
  cover?: any;
  icon?: any;
  parent?: any;
  created_time?: string;
  last_edited_time?: string;
  blocks?: NotionBlock[];
}

export type ProviderEntity =
  | ProviderContact
  | ProviderDeal
  | ProviderCompany
  | ProviderMeeting
  | ProviderNote
  | ProviderTask
  | ProviderPage;

// Organization Management Types
export interface Organization {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  members?: Partial<OrganizationMember>[];
  invitations?: OrganizationInvitation[];
}
export interface Team {
  id: number;
  name: string;
  type: 'personal' | 'department' | 'project';
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  organization_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: number;
  telegram_id: string;
  organization_id: number;
  user_id: number;
  role_id: number;
  role_name: string;
  username?: string;
  user: TelebizUser;
  joined_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role_id: number;
  role_name: string;
  user: TelebizUser;
  joined_at: string;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  invited_by: number;
  invited_user_id: number;
  role_id: number;
  role_name: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  responded_at?: string;
  created_at: string;
  organization: Organization;
  invited_by_user: TelebizUser;
}

export interface TeamInvitation {
  id: number;
  team_id: number;
  invited_by: number;
  user_id: number;
  role_id: number;
  role_name: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  responded_at?: string;
  created_at: string;
  team: Team;
  invited_by_user: TelebizUser;
}

export interface RolePermission {
  id: number;
  action: string;
  name: string;
  description: string;
  resource: string;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string;
  permissions: RolePermission[];
  scope: 'organization' | 'team';
}

// Create/Update Data Types
export interface CreateOrganizationData {
  name: string;
  logo_url?: string;
  description?: string;
  members: Partial<OrganizationMember>[];
}

export interface CreateTeamData {
  name: string;
  type: 'personal' | 'department' | 'project';
  description?: string;
  organization_id: number;
}

export interface InviteUserData {
  user_id: number;
  role_id: number;
  message?: string;
}

export interface UpdateMemberRoleData {
  role_id: number;
}

// Configuration Types
export interface TelebizApiConfig {
  baseUrl?: string;
  timeout: number;
  retryAttempts: number;
  debug: boolean;
}

// Integration System Types
export interface Provider {
  id: number;
  name: string;
  display_name: string;
  description: string;
  icon_url: string;
  category: 'calendar' | 'crm' | 'project_management' | 'communication' | 'storage' | 'analytics';
  supported_scopes: Record<string, string>;
  default_scopes: string[];
  entity_details: ProviderEntityDetail[];
}

export enum ProviderEntityTab {
  Overview = 'overview',
  Meetings = 'meetings',
  Notes = 'notes',
  Tasks = 'tasks',
  Contacts = 'contacts',
  Deals = 'deals',
  Companies = 'companies',
  Pages = 'pages',
  Content = 'content',
}
export interface ProviderEntityDetail {
  type: ProviderEntityType;
  tabs: ProviderEntityTab[];
}

export interface Integration {
  id: number;
  provider: Provider;
  status: IntegrationStatus;
  granted_scopes: string[];
  missing_scopes: string[];
  sync_status: 'idle' | 'syncing' | 'completed' | 'failed';
  last_sync_at?: string;
  activity_sync_enabled?: boolean;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  team?: Team;
  metadata?: Record<string, any>;
  provider_account_email?: string;
  provider_account_id?: string;
  provider_account_name?: string;
  credential?: {
    token_expires_at?: string;
    created_at: string;
  };
}

export interface IntegrationStats {
  total: number;
  active: number;
  error: number;
  byProvider: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface StartOAuthData {
  provider: string;
  organizationId?: number;
  teamId?: number;
  customScopes?: string[];
}

export interface OAuthStartResponse {
  authUrl: string;
  provider: Provider;
  state: string;
}

export interface IntegrationFilters {
  organizationId?: number;
  teamId?: number;
  provider?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ConnectionTestResult {
  connected: boolean;
  error?: string;
  details?: Record<string, any>;
}

export enum ProviderEntityType {
  Contact = 'contact',
  Company = 'company',
  Deal = 'deal',
  Meeting = 'meeting',
  Note = 'note',
  Task = 'task',
  Organization = 'organization',
  Page = 'page',
}
export interface ProviderDynamicEntity {
  id: string;
  label: string;
}

export const PROVIDER_ENTITY_TYPE_TO_PLURAL_MAP = {
  [ProviderEntityType.Contact]: 'contacts',
  [ProviderEntityType.Deal]: 'deals',
  [ProviderEntityType.Company]: 'companies',
  [ProviderEntityType.Meeting]: 'meetings',
  [ProviderEntityType.Note]: 'notes',
  [ProviderEntityType.Task]: 'tasks',
  [ProviderEntityType.Organization]: 'organizations',
  [ProviderEntityType.Page]: 'pages',
};

// Provider Relationship Types
export interface ProviderRelationship {
  id: number;
  user_id: number;
  telegram_id?: string;
  integration_id: number;
  entity_type: ProviderEntityType;
  entity_id: string;
  created_at: string;
  updated_at: string;
  integration?: Partial<Integration>;
}

export interface ProviderActivity {
  timestamp: string;
  type: string;
  value: string;
}

export interface ProviderStage {
  id: string;
  name: string;
  order: number;
  active: boolean;
  probability?: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface ProviderPipeline {
  id: string;
  label: string;
  stages: ProviderStage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyOption {
  label: string;
  value: string;
  color?: string;
  [key: string]: any; // Allow additional provider-specific fields
}

export interface Property {
  name: string;
  label: string;
  type: string;
  fieldType?: string;
  options?: PropertyOption[] | Record<string, PropertyOption[]>;
  dependsOn?: string;
  isCustom?: boolean;
  mandatory?: boolean;
  groupName?: string;
  standardName?: string;
  [key: string]: any; // Allow additional provider-specific fields
}

export interface PropertiesByEntityType {
  id: string;
  label?: string;
  properties: Property[];
}

/**
 * Standard property types that all providers should map to
 */
export enum StandardPropertyType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  BOOLEAN = 'boolean',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  USER = 'user',
  CURRENCY = 'currency',
  UNKNOWN = 'unknown',
  STATUS = 'status',
  STAGE = 'stage',
  ENUM = 'enum',
  SET = 'set',
}

export interface LinkProviderEntityData {
  integrationId: number;
  telegramId: string;
  telegramHandle?: string;
  entityType: ProviderEntityType;
  entityId: string;
  organizationId?: number;
  teamId?: number;
}

export interface AssociateProviderEntityData {
  integrationId: number;
  entityType: ProviderEntityType;
  entityId: string;
  associatedEntityType: ProviderEntityType;
  associatedEntityId: string;
}

export interface CreateProviderEntityData {
  integrationId: number;
  telegramId: string;
  telegramHandle?: string;
  entityType: ProviderEntityType;
  organizationId?: number;
  teamId?: number;
  pipelineId?: string;
  stage?: string;
  parentEntityId?: string;
  parentEntityType?: ProviderEntityType;
  [key: string]: any;
}

export interface DeleteProviderEntityData {
  integrationId: number;
  entityType: ProviderEntityType;
  entityId: string;
  deleteFromProvider?: boolean;
}

export interface ProviderEntityParent {
  entityType: ProviderEntityType;
  entityId: string;
}

export interface ProviderItemOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}

export enum ProviderMeetingStatus {
  Scheduled = 'scheduled',
  Canceled = 'canceled',
  NoShow = 'no_show',
  Rescheduled = 'rescheduled',
  Completed = 'completed',
}

export enum ActionType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export interface ProviderDealDetails {
  closeDate?: string;
  pipeline?: ProviderPipeline;
  stage?: ProviderStage;
  probability?: number;
}

export const ASSOCIATED_ENTITY_TYPES = [
  ProviderEntityType.Deal,
  ProviderEntityType.Contact,
  ProviderEntityType.Page,
  ProviderEntityType.Company,
];

// Reminder Types
export interface Reminder {
  id: number;
  user_id: number;
  organization_id?: number;
  chat_id: string;
  message_id: string;
  title?: string;
  description?: string;
  remind_at: string;
  status: 'pending' | 'done' | 'snoozed' | 'cancelled';
  snoozed_count: number;
  last_snoozed_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  organization?: {
    id: number;
    name: string;
    logo_url?: string;
  };
}

export interface CreateReminderData {
  chat_id: string;
  message_id?: string;
  description?: string;
  remind_at: string;
  organization_id?: number;
  metadata?: Record<string, any>;
}

export interface UpdateReminderData {
  description?: string;
  remind_at?: string;
  metadata?: Record<string, any>;
}

export enum IntegrationStatus {
  Active = 'active',
  Inactive = 'inactive',
  Error = 'error',
  Expired = 'expired',
}

export enum NotificationType {
  REMINDER = 'reminder',
  INVITATION_APPROVED = 'invitation_approved',
  INVITATION_RECEIVED = 'invitation_received',
  SYSTEM = 'system',
  MENTION = 'mention',
  ALERT = 'alert',
  FOLLOWUP = 'followup',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  DISMISSED = 'dismissed',
}

export interface Notification {
  id: number;
  user_id: number;
  organization_id?: number;
  type: NotificationType;
  title?: string;
  message: string;
  status: NotificationStatus;
  related_entity_type?: string;
  related_entity_id?: number;
  action_url?: string;
  metadata?: Record<string, any>;
  read_at?: Date;
  created_at: string;
  snoozed_until?: string;
  organization?: Organization;
}

export enum LoadingType {
  Relationships = 'relationships',
  Pipelines = 'pipelines',
  Entities = 'entities',
  Properties = 'properties',
  Connections = 'connections',
}

export interface TemplatesChat {
  id: number;
  chat_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}
// Activity Sync Types
export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export interface ChatActivitySync {
  chat_id: string;
  chat_type: ChatType;
  last_incoming_at?: string;
  last_outgoing_at?: string;
}

// User Settings Types
export interface UserSettings {
  sync_private_chats: boolean;
  sync_groups: boolean;
}

// Chat Followup Settings Types
export type FollowupPriority = 'low' | 'normal' | 'high';

export interface ChatFollowupSettings {
  chat_id: string;
  followup_enabled: boolean;
  incoming_threshold_minutes: number;
  outgoing_threshold_minutes: number;
  priority: FollowupPriority;
  followup_at?: string;
}
