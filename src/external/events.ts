import { ApiChat } from "../api/types/chats";
import { ApiMessage, ApiUpdateChatInbox } from "../api/types";

export function chatOpened(chatId: string, chat: ApiChat) {}
export function chatClosed() {}

export function loggedIn(userId: string | number) {}
export function loggedOut() {}

export function authStateChanged(
  auth: { authed: false } | { authed: true; userId: string }
) {}

export function newMessage(message: Partial<ApiMessage>) {}
export function updateChatInbox(chatInbox: ApiUpdateChatInbox) {}
export function syncStateChanged(syncState: { isSynced: boolean }) {}
