import { ApiChat } from "../api/types/chats"

export function chatOpened(chatId: string, chat: ApiChat) {}
export function chatClosed() {}

export function loggedIn(userId: string | number) {}
export function loggedOut() {}

export function authStateChanged(auth: { authed: false } | { authed: true, userId: string }) {}
