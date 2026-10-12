import type { ApiAudio, ApiBotInlineMediaResult, ApiBotInlineResult } from '../../../api/types';

import { GLOBAL_SEARCH_SLICE, MUSIC_PICKER_GLOBAL_MIN_QUERY_LENGTH } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getSearchResultKey } from '../../../util/keys/searchResultKey';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addMessages, addMusicSearchAudios, addUserStatuses, updateMusicPicker,
} from '../../reducers';
import {
  selectChat, selectMusicPicker, selectPeer, selectUser,
} from '../../selectors';
import { fetchChatByUsername } from './chats';

let requestGeneration = 0;

addActionHandler('loadMusicPickerShared', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const musicPicker = selectMusicPicker(global, tabId);
  if (!musicPicker) return;

  let shared = musicPicker.shared;
  if (!shared) {
    shared = { generation: getNextGeneration(), ids: [] };
    global = updateMusicPicker(global, { shared }, tabId);
    setGlobal(global);
    global = getGlobal();
  }

  if (shared.isLoading || shared.isFullyLoaded) return;

  const { generation } = shared;
  global = updateMusicPicker(global, { shared: { ...shared, isLoading: true } }, tabId);
  setGlobal(global);
  global = getGlobal();

  const offsetPeer = shared.nextOffsetPeerId ? selectPeer(global, shared.nextOffsetPeerId) : undefined;
  const result = await callApi('searchMessagesGlobal', {
    query: '',
    type: 'audio',
    limit: GLOBAL_SEARCH_SLICE,
    offsetRate: shared.nextOffsetRate,
    offsetId: shared.nextOffsetId,
    offsetPeer,
  });

  global = getGlobal();
  const currentShared = selectMusicPicker(global, tabId)?.shared;
  if (!currentShared || currentShared.generation !== generation) return;

  if (!result) {
    global = updateMusicPicker(global, { shared: { ...currentShared, isLoading: false } }, tabId);
    setGlobal(global);
    return;
  }

  const {
    messages, userStatusesById, totalCount, nextOffsetRate, nextOffsetId, nextOffsetPeerId,
  } = result;

  global = addMessages(global, messages);
  global = addUserStatuses(global, userStatusesById);

  const newIds = messages
    .filter((message) => !message.isProtected && !selectChat(global, message.chatId)?.isProtected)
    .map(getSearchResultKey)
    .filter((id) => !currentShared.ids.includes(id));
  const loadedCount = (currentShared.loadedCount || 0) + messages.length;

  global = updateMusicPicker(global, {
    shared: {
      generation,
      ids: [...currentShared.ids, ...newIds],
      loadedCount,
      totalCount,
      nextOffsetRate,
      nextOffsetId,
      nextOffsetPeerId,
      isLoading: false,
      isFullyLoaded: !messages.length || loadedCount >= totalCount,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadMusicPickerGlobal', async (global, actions, payload): Promise<void> => {
  const { query, tabId = getCurrentTabId() } = payload;
  const musicPicker = selectMusicPicker(global, tabId);
  const username = global.appConfig.musicSearchUsername;
  if (!musicPicker || !username || query.length < MUSIC_PICKER_GLOBAL_MIN_QUERY_LENGTH) return;

  let globalResults = musicPicker.global;
  if (globalResults?.query !== query) {
    globalResults = { query, generation: getNextGeneration(), ids: [] };
    global = updateMusicPicker(global, { global: globalResults }, tabId);
    setGlobal(global);
    global = getGlobal();
  }

  if (globalResults.isLoading || globalResults.isFullyLoaded) return;

  const { generation } = globalResults;
  global = updateMusicPicker(global, { global: { ...globalResults, isLoading: true } }, tabId);
  setGlobal(global);
  global = getGlobal();

  const chat = selectChat(global, musicPicker.chatId);
  const botChat = await fetchChatByUsername(global, username);
  global = getGlobal();
  const bot = botChat ? selectUser(global, botChat.id) : undefined;
  const result = chat && bot ? await callApi('fetchInlineBotResults', {
    bot,
    chat,
    query,
    offset: globalResults.nextOffset,
  }) : undefined;

  global = getGlobal();
  const currentGlobal = selectMusicPicker(global, tabId)?.global;
  if (!currentGlobal || currentGlobal.query !== query || currentGlobal.generation !== generation) return;

  if (!result) {
    global = updateMusicPicker(global, { global: { ...currentGlobal, isLoading: false } }, tabId);
    setGlobal(global);
    return;
  }

  const audios = result.results.filter(isAudioResult).map((item) => item.audio);
  const newIds = audios.map((audio) => audio.id).filter((id) => !currentGlobal.ids.includes(id));

  global = addMusicSearchAudios(global, audios);
  global = updateMusicPicker(global, {
    global: {
      query,
      generation,
      ids: [...currentGlobal.ids, ...newIds],
      nextOffset: result.nextOffset || undefined,
      isLoading: false,
      isFullyLoaded: !result.nextOffset,
    },
  }, tabId);
  setGlobal(global);
});

function getNextGeneration() {
  requestGeneration += 1;
  return requestGeneration;
}

function isAudioResult(
  item: ApiBotInlineResult | ApiBotInlineMediaResult,
): item is ApiBotInlineMediaResult & { audio: ApiAudio } {
  return item.type === 'audio' && 'audio' in item && Boolean(item.audio);
}
