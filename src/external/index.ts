import { makeRequest } from "../api/gramjs/worker/connector"
import { getActions, getGlobal } from "../global"
import { Requester, Responder } from "jsonrpc-iframe"
import * as CUSTOM from "./custom"
import { Actions, Custom, Events, Methods } from "./types"
import { selectChat, selectCurrentMessageList } from "../global/selectors"

const MAIN_FRAME_ORIGIN = "*"

let actions = new Responder<Actions>("actions", MAIN_FRAME_ORIGIN)

actions.subscribeUniversal(async (name, args) =>
{
	console.log("Received action", name, args)

	let acts = getActions()
	let method = acts[name] as (...args: any[]) => any
	let result = await method(...args)
	console.log(`${name}(${JSON.stringify(args)}) = `, result)
	return result
})

let clientApi = new Responder<Methods>("methods", MAIN_FRAME_ORIGIN)

clientApi.subscribeUniversal((name, args) =>
{
	console.log("Received client-api", name)

	return makeRequest({
		type: "callMethod",
		name: name,
		args: args,
	})
})

let custom = new Responder<Custom>("custom", MAIN_FRAME_ORIGIN)

custom.subscribeUniversal((name, args) =>
{
	console.log("Received custom", name, args)

	let method = CUSTOM[name] as (...args: any[]) => any
	return method(...args)
})

export let events = new Requester<Events>("events", window.parent.window, MAIN_FRAME_ORIGIN)

export function __init()
{
	let oldChatId: string | undefined
	let oldAuth = {
		authed: false,
		userId: undefined as string | undefined,
	}
	const check = () =>
	{
		let global = getGlobal()
		
		let chatId = selectCurrentMessageList(global)?.chatId
		if (chatId != oldChatId)
		{
			oldChatId = chatId
			if (chatId)
			{
				let chat = selectChat(global, chatId)
				events.proxy.chatOpened(chatId, chat!)
			}
			else
			{
				events.proxy.chatClosed()
			}
		}

		let auth = CUSTOM.getAuthInfo()
		if (auth.authed)
			if (!oldAuth.authed || oldAuth.userId != auth.userId)
				events.proxy.loggedIn(auth.userId), events.proxy.authStateChanged(auth)
		
		if (!auth.authed && oldAuth.authed)
			events.proxy.loggedOut(), events.proxy.authStateChanged(auth)

		window.requestAnimationFrame(check)
	}
	window.requestAnimationFrame(check)
}
