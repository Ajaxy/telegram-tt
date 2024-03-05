import { getGlobal } from "../global"
import { selectChat, selectChatFolder, selectChatFullInfo, selectChatLastMessage } from "../global/selectors"

export function getChatsInTheFolder(folderId: number)
{
	let g = getGlobal()
	let folder = selectChatFolder(g, folderId)
	let ids = folder.includedChatIds
	return ids.map(id => ({
		id: parseInt(id),
		chat: selectChat(g, id),
		fullInfo: selectChatFullInfo(g, id),
		msg: selectChatLastMessage(g, id, "all"),
	}))
}

export function getAuthInfo(): { authed: false } | { authed: true, userId: string }
{
	let g = getGlobal()
	let authed = g.authState == "authorizationStateReady"
	let userId = g.currentUserId
	if (!authed || !userId)
		return { authed: false }

	return {
		authed: true,
		userId,
	}
}
