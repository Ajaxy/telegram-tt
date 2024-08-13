import { makeRequest } from "../api/gramjs/worker/connector";
import { getActions, getGlobal } from "../global";
import { Requester, Responder } from "jsonrpc-iframe";
import * as CUSTOM from "./custom";
import { Actions, Custom, Events, Methods } from "./types";
import { selectChat, selectCurrentMessageList } from "../global/selectors";
import { addActionHandler } from "../global";
import { ActionReturnType } from "../global/types";
import { getCurrentTabId } from "../util/establishMultitabRole";

const MAIN_FRAME_ORIGIN =
  process.env.MAIN_FRAME_ORIGIN || "https://crm.dise.app";

console.log({ NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV });

let actions = new Responder<Actions>("actions", MAIN_FRAME_ORIGIN);

actions.subscribeUniversal(async (name, args) => {
  console.log("Received action", name, args);

  let acts = getActions();
  let method = acts[name] as (...args: any[]) => any;
  let result = await method(...args);
  console.log(`${name}(${JSON.stringify(args)}) = `, result);
  return result;
});

let clientApi = new Responder<Methods>("methods", MAIN_FRAME_ORIGIN);

clientApi.subscribeUniversal((name, args) => {
  console.log("Received client-api", name);

  return makeRequest({
    type: "callMethod",
    name: name,
    args: args,
  });
});

let custom = new Responder<Custom>("custom", MAIN_FRAME_ORIGIN);

custom.subscribeUniversal((name, args) => {
  console.log("Received custom", name, args);

  let method = CUSTOM[name] as (...args: any[]) => any;
  return method(...args);
});

let status = new Responder("status", MAIN_FRAME_ORIGIN);

status.subscribeUniversal((name) => {
  return true;
});

export let events = new Requester<Events>(
  "events",
  window.parent.window,
  MAIN_FRAME_ORIGIN
);

export function __init() {
  let oldChatId: string | undefined;
  let oldAuth = {
    authed: false,
    userId: undefined as string | undefined,
  };

  let actions = getActions();

  addActionHandler("apiUpdate", (global, actions, update): ActionReturnType => {
    switch (update["@type"]) {
      case "newMessage": {
        const { chatId, id, message, shouldForceReply, wasDrafted } = update;
        events.proxy.newMessage(message);
        break;
      }
      case "updateChatInbox": {
        events.proxy.updateChatInbox(update);
      }
      case "updateChat": {
        events.proxy.updateChat(update);
      }
      case "updateChatMembers": {
        events.proxy.updateChatMembers(update);
      }
      default:
        break;
    }
  });

  addActionHandler(
    "loadAllChats",
    async (global, actions, payload): Promise<void> => {
      if (
        global.connectionState === "connectionStateReady" &&
        global.isSynced
      ) {
        events.proxy.syncStateChanged({ isSynced: true });
      }
    }
  );

  addActionHandler(
    "signOut",
    async (global, actions, payload): Promise<void> => {
      events.proxy.loggedOut();
      events.proxy.syncStateChanged({ isSynced: false });
    }
  );

  addActionHandler("initShared", (global): ActionReturnType => {
    actions.setSettingOption({ shouldUseSystemTheme: false, theme: "light" });
  });

  addActionHandler(
    "markMessageListRead",
    (global, actions, payload): ActionReturnType => {
      const { maxId, tabId = getCurrentTabId() } = payload!;

      const currentMessageList = selectCurrentMessageList(global, tabId);
      if (!currentMessageList) {
        return undefined;
      }

      const { chatId } = currentMessageList;
      const chat = selectChat(global, chatId);
      events.proxy.markMessageListRead(chat);
    }
  );

  const check = () => {
    // let g = getGlobal();

    // let chatId = selectCurrentMessageList(global)?.chatId;
    // if (chatId != oldChatId) {
    //   oldChatId = chatId;
    //   if (chatId) {
    //     let chat = selectChat(global, chatId);
    //     events.proxy.chatOpened(chatId, chat!);
    //   } else {
    //     events.proxy.chatClosed();
    //   }
    // }

    let auth = CUSTOM.getAuthInfo();
    if (auth.authed)
      if (!oldAuth.authed || oldAuth.userId != auth.userId)
        events.proxy.loggedIn(auth.userId), events.proxy.authStateChanged(auth);

    if (!auth.authed && oldAuth.authed)
      events.proxy.loggedOut(), events.proxy.authStateChanged(auth);

    window.requestAnimationFrame(check);
  };
  window.requestAnimationFrame(check);
}
