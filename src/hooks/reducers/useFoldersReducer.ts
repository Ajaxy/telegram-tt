import useReducer, { StateReducer, Dispatch } from '../useReducer';
import { ApiChatFolder } from '../../api/types';
import { pick, omit } from '../../util/iteratees';

export type FolderChatType = {
  icon: string;
  title: string;
  key: keyof Pick<ApiChatFolder, (
    'contacts' | 'nonContacts' | 'groups' | 'channels' | 'bots' |
    'excludeMuted' | 'excludeArchived' | 'excludeRead'
  )>;
};

export const INCLUDED_CHAT_TYPES: FolderChatType[] = [
  { icon: 'user', title: 'FilterContacts', key: 'contacts' },
  { icon: 'non-contacts', title: 'FilterNonContacts', key: 'nonContacts' },
  { icon: 'group', title: 'FilterGroups', key: 'groups' },
  { icon: 'channel', title: 'FilterChannels', key: 'channels' },
  { icon: 'bots', title: 'FilterBots', key: 'bots' },
];

export const EXCLUDED_CHAT_TYPES: FolderChatType[] = [
  { icon: 'mute', title: 'FilterMuted', key: 'excludeMuted' },
  { icon: 'archive', title: 'FilterArchived', key: 'excludeArchived' },
  { icon: 'readchats', title: 'FilterRead', key: 'excludeRead' },
];

const INCLUDE_FILTER_FIELDS: Array<keyof FolderIncludeFilters> = [
  'includedChatIds', 'bots', 'channels', 'groups', 'contacts', 'nonContacts',
];
const EXCLUDE_FILTER_FIELDS: Array<keyof FolderExcludeFilters> = [
  'excludedChatIds', 'excludeArchived', 'excludeMuted', 'excludeRead',
];

export function selectChatFilters(state: FoldersState, mode: 'included' | 'excluded', selectTemp?: boolean) {
  let selectedChatIds: number[] = [];
  let selectedChatTypes: FolderChatType['key'][] = [];

  if (mode === 'included') {
    const {
      includedChatIds,
      ...includeFilters
    } = selectTemp
      ? state.includeFilters || {}
      : pick(
        state.folder,
        INCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = includedChatIds || [];
    selectedChatTypes = (Object.keys(includeFilters) as Array<keyof typeof includeFilters>)
      .filter((key) => Boolean(includeFilters[key]));
  } else {
    const {
      excludedChatIds,
      ...excludeFilters
    } = selectTemp
      ? state.excludeFilters || {}
      : pick(
        state.folder,
        EXCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = excludedChatIds || [];
    selectedChatTypes = (Object.keys(excludeFilters) as Array<keyof typeof excludeFilters>)
      .filter((key) => Boolean(excludeFilters[key]));
  }

  return {
    selectedChatIds,
    selectedChatTypes,
  };
}

function getSuggestedFolderName(includeFilters?: FolderIncludeFilters) {
  if (includeFilters) {
    const {
      includedChatIds,
      ...filters
    } = includeFilters;

    if (
      Object.values(filters).filter(Boolean).length > 1
      || (includedChatIds && includedChatIds.length)
    ) {
      return '';
    }

    if (filters.bots) {
      return 'Bots';
    } else if (filters.groups) {
      return 'Groups';
    } else if (filters.channels) {
      return 'Channels';
    } else if (filters.contacts) {
      return 'Contacts';
    } else if (filters.nonContacts) {
      return 'Non-Contacts';
    }
  }

  return '';
}

type FolderIncludeFilters = Pick<ApiChatFolder, (
  'includedChatIds' | 'bots' | 'channels' | 'groups' | 'contacts' | 'nonContacts'
)>;
type FolderExcludeFilters = Pick<ApiChatFolder, 'excludedChatIds' | 'excludeArchived' | 'excludeMuted' | 'excludeRead'>;

export type FoldersState = {
  mode: 'create' | 'edit';
  isLoading?: boolean;
  isTouched?: boolean;
  error?: string;
  folderId?: number;
  chatFilter: string;
  folder: Omit<ApiChatFolder, 'id' | 'description' | 'emoticon'>;
  includeFilters?: FolderIncludeFilters;
  excludeFilters?: FolderExcludeFilters;
};
export type FoldersActions = (
  'setTitle' | 'saveFilters' | 'editFolder' | 'reset' | 'setChatFilter' | 'setIsLoading' | 'setError' |
  'editIncludeFilters' | 'editExcludeFilters' | 'setIncludeFilters' | 'setExcludeFilters'
);
export type FolderEditDispatch = Dispatch<FoldersActions>;

const INITIAL_STATE: FoldersState = {
  mode: 'create',
  chatFilter: '',
  folder: {
    title: '',
    includedChatIds: [],
    excludedChatIds: [],
  },
};

const foldersReducer: StateReducer<FoldersState, FoldersActions> = (
  state,
  action,
) => {
  switch (action.type) {
    case 'setTitle':
      return {
        ...state,
        folder: {
          ...state.folder,
          title: action.payload,
        },
        isTouched: true,
      };
    case 'editIncludeFilters':
      return {
        ...state,
        includeFilters: pick(
          state.folder,
          INCLUDE_FILTER_FIELDS,
        ),
      };
    case 'editExcludeFilters':
      return {
        ...state,
        excludeFilters: pick(
          state.folder,
          EXCLUDE_FILTER_FIELDS,
        ),
      };
    case 'setIncludeFilters':
      return {
        ...state,
        includeFilters: action.payload,
        chatFilter: '',
      };
    case 'setExcludeFilters':
      return {
        ...state,
        excludeFilters: action.payload,
        chatFilter: '',
      };
    case 'saveFilters':
      if (state.includeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, INCLUDE_FILTER_FIELDS),
            title: state.folder.title ? state.folder.title : getSuggestedFolderName(state.includeFilters),
            ...state.includeFilters,
          },
          includeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else if (state.excludeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, EXCLUDE_FILTER_FIELDS),
            ...state.excludeFilters,
          },
          excludeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else {
        return state;
      }
    case 'editFolder': {
      const { id: folderId, description, ...folder } = action.payload;

      return {
        mode: 'edit',
        folderId,
        folder,
        chatFilter: '',
      };
    }
    case 'setChatFilter': {
      return {
        ...state,
        chatFilter: action.payload,
      };
    }
    case 'setIsLoading': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case 'setError': {
      return {
        ...state,
        error: action.payload,
      };
    }
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
};

export default () => {
  return useReducer(foldersReducer, INITIAL_STATE);
};
