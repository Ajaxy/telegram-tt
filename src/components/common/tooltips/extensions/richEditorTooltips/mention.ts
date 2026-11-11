/* eslint-disable no-null/no-null */
import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getGlobal } from '../../../../../global';

import type { ApiUser } from '../../../../../api/types';
import type { ThreadId } from '../../../../../types';
import type {
  RichEditorInsertContent,
} from '../../../../middle/composer/richEditorTypes';
import type {
  RichEditorTooltipItem, RichEditorTooltipsConfig, RichEditorTooltipSuggestion,
} from '../../types';
import { MAIN_THREAD_ID } from '../../../../../api/types';

import { getMainUsername, isChatSuperGroup } from '../../../../../global/helpers';
import {
  filterPeersByQuery, getPeerTitle, isApiPeerUser,
} from '../../../../../global/helpers/peers';
import { selectChat } from '../../../../../global/selectors';
import { pickTruthy, unique } from '../../../../../util/iteratees';
import { getTranslationFn } from '../../../../../util/localization';
import { debounce } from '../../../../../util/schedulers';
import { callApi } from '../../../../../api/gramjs';
import { replaceEditorRange } from '../../../../middle/composer/helpers/richEditorComposer';
import {
  buildBlockMatch,
  buildSuggestionRenderer,
  type GetTooltipController,
  hasUnsuitableContext,
  PLUGIN_KEYS,
  SEARCH_DEBOUNCE_MS,
  TOOLTIP_GAP_PX,
} from './suggestion';

export function buildMentionSuggestion(
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  return Suggestion<RichEditorTooltipItem, RichEditorTooltipItem>({
    editor,
    pluginKey: PLUGIN_KEYS.mention,
    placement: 'top-start',
    offset: { mainAxis: TOOLTIP_GAP_PX },
    dismissOnOutsideClick: false,
    findSuggestionMatch: findMentionMatch,
    allow: () => config.mention!.isEnabled(),
    items: ({ query }) => filterMentionUsers(config, query),
    command: ({ editor: currentEditor, range, props }) => {
      const user = props as ApiUser;
      const content = buildMentionContent(user);
      if (!content) {
        return;
      }

      replaceEditorRange(currentEditor, range, content);
    },
    shouldResetDismissed: ({ transaction }) => transaction.docChanged,
    render: () => {
      const renderer = buildSuggestionRenderer('mention', getController);
      let currentProps: RichEditorTooltipSuggestion | undefined;

      const searchRemote = debounce(async (props: RichEditorTooltipSuggestion) => {
        const { chatId, threadId } = config.getContext();
        const memberIds = await searchMentionMemberIds(chatId, threadId, props.query);
        if (!memberIds?.length || currentProps !== props) {
          return;
        }

        currentProps = {
          ...props,
          items: mergeMemberIds(props.items as ApiUser[], memberIds, config.getContext().currentUserId),
        };
        renderer.onUpdate(currentProps);
      }, SEARCH_DEBOUNCE_MS, false);

      const update = (props: RichEditorTooltipSuggestion) => {
        currentProps = props;
        renderer.onUpdate(props);
        if (!props.loading && props.query) {
          searchRemote(props);
        }
      };

      return {
        ...renderer,
        onStart: update,
        onUpdate: update,
        onExit: () => {
          currentProps = undefined;
          renderer.onExit();
        },
      };
    },
  });
}

async function searchMentionMemberIds(chatId: string, threadId: ThreadId | undefined, query: string) {
  const chat = selectChat(getGlobal(), chatId);
  if (!chat || !isChatSuperGroup(chat)) {
    return undefined;
  }

  const topMsgId = typeof threadId === 'number' && threadId !== MAIN_THREAD_ID ? threadId : undefined;
  const result = await callApi('fetchMembers', { chat, memberFilter: 'mentions', query, topMsgId });
  return result?.members?.map(({ userId }) => userId);
}

function mergeMemberIds(localUsers: ApiUser[], memberIds: string[], currentUserId?: string) {
  const usersById = getGlobal().users.byId;
  const ids = unique([...localUsers.map(({ id }) => id), ...memberIds.filter((id) => id !== currentUserId)]);

  return ids.map((id) => usersById[id]).filter(Boolean);
}

function findMentionMatch({ $position }: { $position: ResolvedPos }): SuggestionMatch {
  if (!$position.parent.isTextblock || hasUnsuitableContext($position)) {
    return null;
  }

  const textBefore = $position.parent.textBetween(0, $position.parentOffset, '\n', '\n');
  const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/u);
  if (!match) {
    return null;
  }

  const text = match[0].trimStart();
  return buildBlockMatch($position, text, text.slice(1));
}

function filterMentionUsers(config: RichEditorTooltipsConfig, query: string) {
  const context = config.getContext();
  const usersById = getGlobal().users.byId;
  const memberIds = context.groupChatMembers?.reduce((result: string[], member) => {
    if (member.userId !== context.currentUserId) {
      result.push(member.userId);
    }
    return result;
  }, []);
  const ids = unique([
    ...(context.topInlineBotIds || []),
    ...(memberIds || []),
    ...(context.topGuestBotIds || []),
  ]);
  const filteredIds = filterPeersByQuery({ ids, query, type: 'user' });
  return Object.values(pickTruthy(usersById, filteredIds));
}

function buildMentionContent(user: ApiUser): RichEditorInsertContent[] | undefined {
  const mainUsername = getMainUsername(user);
  const title = (isApiPeerUser(user) && user.firstName) || getPeerTitle(getTranslationFn(), user) || '';
  const text = mainUsername ? `@${mainUsername}` : title;
  if (!text) {
    return undefined;
  }

  if (!user.accessHash) {
    return [{ type: 'text', text: `${text} ` }];
  }

  return [{
    type: 'mention',
    userId: user.id,
    username: mainUsername,
    text,
  }, { type: 'text', text: ' ' }];
}
