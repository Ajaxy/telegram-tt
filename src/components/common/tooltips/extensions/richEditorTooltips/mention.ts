/* eslint-disable no-null/no-null */
import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getGlobal } from '../../../../../global';

import type { ApiUser } from '../../../../../api/types';
import type {
  RichEditorInsertContent,
} from '../../../../middle/composer/richEditorTypes';
import type { RichEditorTooltipItem, RichEditorTooltipsConfig } from '../../types';

import { getMainUsername } from '../../../../../global/helpers';
import {
  filterPeersByQuery, getPeerTitle, isApiPeerUser,
} from '../../../../../global/helpers/peers';
import { pickTruthy, unique } from '../../../../../util/iteratees';
import { getTranslationFn } from '../../../../../util/localization';
import { replaceEditorRange } from '../../../../middle/composer/helpers/richEditorComposer';
import {
  buildBlockMatch,
  buildSuggestionRenderer,
  type GetTooltipController,
  hasUnsuitableContext,
  PLUGIN_KEYS,
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
    render: () => buildSuggestionRenderer('mention', getController),
  });
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

  return [{
    type: 'mention',
    userId: user.id,
    username: mainUsername,
    text,
  }, { type: 'text', text: ' ' }];
}
