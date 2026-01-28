import { addActionHandler, getActions } from '../../../global';

import type { ActionReturnType } from '../../../global/types';

import { AUTH_BOT_USERNAME } from '../../../config';
import { selectChatByUsername } from '../../../global/selectors';
import { logDebugMessage } from '../../../util/debugConsole';
import { selectIsTelebizAuthenticated, selectTelebizAuthStep } from '../selectors';

addActionHandler('apiUpdate', (global, _actions, update): ActionReturnType => {
  if (update['@type'] !== 'newMessage') return undefined;

  // Skip if already authenticated
  if (selectIsTelebizAuthenticated(global)) return undefined;

  const authStep = selectTelebizAuthStep(global);
  if (authStep !== 'waiting_for_token') return undefined;

  if (!AUTH_BOT_USERNAME) return undefined;

  const { message } = update;
  const text = message.content?.text?.text;
  if (!text) return undefined;

  // Check for JWT pattern first
  const jwtMatch = text.match(/([A-Za-z0-9_-]{4,}\.)[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/);
  if (!jwtMatch) return undefined;

  // Verify the message is from the auth bot (if we can find it)
  // On first visit, the bot chat might not be indexed yet, so we fall back to accepting the JWT
  const botChat = selectChatByUsername(global, AUTH_BOT_USERNAME);
  if (botChat && update.chatId !== botChat.id) {
    // We found the bot chat but this message is from a different chat - ignore
    return undefined;
  }

  // If botChat is undefined (first visit) or chatId matches, process the JWT
  logDebugMessage('log', 'TELEBIZ_AUTH: JWT token found in new message', botChat ? '(verified bot)' : '(bot chat not indexed yet)');
  getActions().telebizProcessJWTToken({ token: jwtMatch[0] });

  return undefined;
});
