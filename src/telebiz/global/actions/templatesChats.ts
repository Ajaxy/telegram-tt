import { addActionHandler, getGlobal, setGlobal } from '../../../global';

import { telebizApiClient } from '../../services';
import { addTelebizTemplatesChat,
  removeTelebizTemplatesChat,
  setErrorTelebizTemplatesChats,
  setIsLoadingTelebizTemplatesChats,
  setTelebizTemplatesChatsList,
} from '../reducers/templatesChats';
import { selectIsTelebizAuthenticated } from '../selectors';

addActionHandler('loadTelebizTemplatesChats', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  global = getGlobal();
  global = setIsLoadingTelebizTemplatesChats(global, true);
  setGlobal(global);

  try {
    const templatesChats = await telebizApiClient.templatesChats.getTemplatesChats();
    global = getGlobal();
    global = setTelebizTemplatesChatsList(global, templatesChats.map((tc) => tc.chat_id));
    setGlobal(global);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch templates chats';
    global = getGlobal();
    global = setErrorTelebizTemplatesChats(global, errorMessage);
    setGlobal(global);
  } finally {
    global = getGlobal();
    global = setIsLoadingTelebizTemplatesChats(global, false);
    setGlobal(global);
  }
});

addActionHandler('addTelebizTemplatesChat', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { chatId } = payload;
  try {
    const templatesChat = await telebizApiClient.templatesChats.addTemplatesChat(chatId);
    if (!templatesChat) {
      throw new Error('Failed to add templates chat');
    }
    global = getGlobal();
    global = addTelebizTemplatesChat(global, templatesChat.chat_id);
    setGlobal(global);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add templates chat';
    global = getGlobal();
    global = setErrorTelebizTemplatesChats(global, errorMessage);
    setGlobal(global);
  }
});

addActionHandler('removeTelebizTemplatesChat', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { chatId } = payload;
  try {
    await telebizApiClient.templatesChats.removeTemplatesChat(chatId);
    global = getGlobal();
    global = removeTelebizTemplatesChat(global, chatId);
    setGlobal(global);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove templates chat';
    global = getGlobal();
    global = setErrorTelebizTemplatesChats(global, errorMessage);
    setGlobal(global);
  }
});

addActionHandler('updateTelebizTemplatesChatsList', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { chatIds } = payload;
  try {
    await telebizApiClient.templatesChats.updateTemplatesChatsList(chatIds);
    global = getGlobal();
    global = setTelebizTemplatesChatsList(global, chatIds);
    setGlobal(global);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update templates chats list';
    global = getGlobal();
    global = setErrorTelebizTemplatesChats(global, errorMessage);
    setGlobal(global);
  }
});
