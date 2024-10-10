import {
  makeRequest,
  makeRequestToMaster,
} from "../api/gramjs/worker/connector";
import { getActions, getGlobal } from "../global";
import { Requester, Responder } from "jsonrpc-iframe";
import * as CUSTOM from "./custom";
import { Actions, Custom, Events, Methods } from "./types";
import { selectChat, selectCurrentMessageList } from "../global/selectors";
import { addActionHandler } from "../global";
import { ActionReturnType } from "../global/types";
import { getCurrentTabId } from "../util/establishMultitabRole";
import { selectTabState } from "../global/selectors";
import { StringFilterSource } from "jsonrpc-iframe/string-filter";

const DEFAULT_ORIGIN = "https://crm.dise.app";

const env = process.env
const MAIN_FRAME_ORIGIN = env.MAIN_FRAME_ORIGIN || DEFAULT_ORIGIN;

const MAIN_FRAME_ORIGIN_REGEXP = env.MAIN_FRAME_ORIGIN_REGEXP 
const DISE_ENV = env.DISE_ENV 

let MAIN_FRAME_ORIGIN_STR_OR_REGEXP: StringFilterSource = MAIN_FRAME_ORIGIN
if (DISE_ENV === "testing" && MAIN_FRAME_ORIGIN_REGEXP) {
  MAIN_FRAME_ORIGIN_STR_OR_REGEXP = new RegExp(`${MAIN_FRAME_ORIGIN_REGEXP}`)
}

let actions = new Responder<Actions>("actions", MAIN_FRAME_ORIGIN_STR_OR_REGEXP);

actions.subscribeUniversal(async (name, args) => {
  console.log("Received action", name, args);

  let acts = getActions();
  let method = acts[name] as (...args: any[]) => any;
  let result = await method(...args);
  console.log(`${name}(${JSON.stringify(args)}) = `, result);
  return result;
});

let clientApi = new Responder<Methods>("methods", MAIN_FRAME_ORIGIN_STR_OR_REGEXP);

clientApi.subscribeUniversal((name, args) => {
  const global = getGlobal();

  const promise = selectTabState(global).isMasterTab
    ? makeRequest({
        type: "callMethod",
        name: name,
        args,
      })
    : makeRequestToMaster({
        name: name,
        args,
      });

  return promise;

  // return makeRequest({
  //   type: "callMethod",
  //   name: name,
  //   args: args,
  // });
});

let custom = new Responder<Custom>("custom", MAIN_FRAME_ORIGIN_STR_OR_REGEXP);

custom.subscribeUniversal((name, args) => {
  // console.log("Received custom", name, args);

  let method = CUSTOM[name] as (...args: any[]) => any;
  return method(...args);
});

let status = new Responder("status", MAIN_FRAME_ORIGIN_STR_OR_REGEXP);

status.subscribeUniversal((name) => {
  return true;
});

export let events = new Requester<Events>(
  "events",
  window.parent.window,
  MAIN_FRAME_ORIGIN
);

export function __init() {
  // let oldChatId: string | undefined;
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
      if (global.connectionState === "connectionStateReady") {
        events.proxy.syncStateChanged({ isSynced: true });
      }
    }
  );

  addActionHandler(
    "loadChatFolders",
    async (global, actions, payload): Promise<void> => {
      if (global.connectionState === "connectionStateReady") {
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
