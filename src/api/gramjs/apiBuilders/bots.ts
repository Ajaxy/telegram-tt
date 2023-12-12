import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAttachBot,
  ApiAttachBotIcon,
  ApiAttachMenuPeerType,
  ApiBotApp,
  ApiBotCommand,
  ApiBotInfo,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotInlineSwitchWebview,
  ApiBotMenuButton,
  ApiInlineResultType,
  ApiMessagesBotApp,
} from '../../types';

import { pick } from '../../../util/iteratees';
import localDb from '../localDb';
import { buildApiPhoto, buildApiThumbnailFromStripped } from './common';
import { omitVirtualClassFields } from './helpers';
import { buildApiDocument, buildApiWebDocument, buildVideoFromDocument } from './messageContent';
import { buildApiPeerId } from './peers';
import { buildStickerFromDocument } from './symbols';

export function buildApiBotInlineResult(result: GramJs.BotInlineResult, queryId: string): ApiBotInlineResult {
  const {
    id, type, title, description, url, thumb,
  } = result;

  return {
    id,
    queryId,
    type: type as ApiInlineResultType,
    title,
    description,
    url,
    webThumbnail: buildApiWebDocument(thumb),
  };
}

export function buildApiBotInlineMediaResult(
  result: GramJs.BotInlineMediaResult, queryId: string,
): ApiBotInlineMediaResult {
  const {
    id, type, title, description, photo, document,
  } = result;

  return {
    id,
    queryId,
    type: type as ApiInlineResultType,
    title,
    description,
    ...(type === 'sticker' && document instanceof GramJs.Document && { sticker: buildStickerFromDocument(document) }),
    ...(photo instanceof GramJs.Photo && { photo: buildApiPhoto(photo) }),
    ...(type === 'gif' && document instanceof GramJs.Document && { gif: buildVideoFromDocument(document) }),
    ...(type === 'video' && document instanceof GramJs.Document && {
      thumbnail: buildApiThumbnailFromStripped(document.thumbs),
    }),
  };
}

export function buildBotSwitchPm(switchPm?: GramJs.InlineBotSwitchPM) {
  return switchPm ? pick(switchPm, ['text', 'startParam']) as ApiBotInlineSwitchPm : undefined;
}

export function buildBotSwitchWebview(switchWebview?: GramJs.InlineBotWebView) {
  return switchWebview ? pick(switchWebview, ['text', 'url']) as ApiBotInlineSwitchWebview : undefined;
}

export function buildApiAttachBot(bot: GramJs.AttachMenuBot): ApiAttachBot {
  return {
    id: bot.botId.toString(),
    shouldRequestWriteAccess: bot.requestWriteAccess,
    shortName: bot.shortName,
    isForAttachMenu: bot.showInAttachMenu!,
    isForSideMenu: bot.showInSideMenu,
    attachMenuPeerTypes: bot.peerTypes?.map(buildApiAttachMenuPeerType)!,
    icons: bot.icons.map(buildApiAttachMenuIcon).filter(Boolean),
    isInactive: bot.inactive,
    isDisclaimerNeeded: bot.sideMenuDisclaimerNeeded,
  };
}

function buildApiAttachMenuPeerType(peerType: GramJs.TypeAttachMenuPeerType): ApiAttachMenuPeerType {
  if (peerType instanceof GramJs.AttachMenuPeerTypeBotPM) return 'bots';
  if (peerType instanceof GramJs.AttachMenuPeerTypePM) return 'users';
  if (peerType instanceof GramJs.AttachMenuPeerTypeChat) return 'chats';
  if (peerType instanceof GramJs.AttachMenuPeerTypeBroadcast) return 'channels';
  if (peerType instanceof GramJs.AttachMenuPeerTypeSameBotPM) return 'self';
  return undefined!; // Never reached
}

function buildApiAttachMenuIcon(icon: GramJs.AttachMenuBotIcon): ApiAttachBotIcon | undefined {
  if (!(icon.icon instanceof GramJs.Document)) return undefined;

  const document = buildApiDocument(icon.icon);

  if (!document) return undefined;

  localDb.documents[String(icon.icon.id)] = icon.icon;

  return {
    name: icon.name,
    document,
  };
}

export function buildApiBotInfo(botInfo: GramJs.BotInfo, chatId: string): ApiBotInfo {
  const {
    description, descriptionPhoto, descriptionDocument, userId, commands, menuButton,
  } = botInfo;

  const botId = userId && buildApiPeerId(userId, 'user');
  const photo = descriptionPhoto instanceof GramJs.Photo ? buildApiPhoto(descriptionPhoto) : undefined;
  const gif = descriptionDocument instanceof GramJs.Document ? buildVideoFromDocument(descriptionDocument) : undefined;

  const commandsArray = commands?.map((command) => buildApiBotCommand(botId || chatId, command));

  return {
    botId: botId || chatId,
    description,
    gif,
    photo,
    menuButton: buildApiBotMenuButton(menuButton),
    commands: commandsArray?.length ? commandsArray : undefined,
  };
}

function buildApiBotCommand(botId: string, command: GramJs.BotCommand): ApiBotCommand {
  return {
    botId,
    ...omitVirtualClassFields(command),
  };
}

export function buildApiBotMenuButton(menuButton?: GramJs.TypeBotMenuButton): ApiBotMenuButton {
  if (menuButton instanceof GramJs.BotMenuButton) {
    return {
      type: 'webApp',
      text: menuButton.text,
      url: menuButton.url,
    };
  }

  return {
    type: 'commands',
  };
}

export function buildApiBotApp(app: GramJs.TypeBotApp): ApiBotApp | undefined {
  if (app instanceof GramJs.BotAppNotModified) return undefined;

  const {
    id, accessHash, title, description, shortName, photo, document,
  } = app;

  const apiPhoto = photo instanceof GramJs.Photo ? buildApiPhoto(photo) : undefined;
  const apiDocument = document instanceof GramJs.Document ? buildApiDocument(document) : undefined;

  return {
    id: id.toString(),
    accessHash: accessHash.toString(),
    title,
    description,
    shortName,
    photo: apiPhoto,
    document: apiDocument,
  };
}

export function buildApiMessagesBotApp(botApp: GramJs.messages.BotApp): ApiMessagesBotApp | undefined {
  const { app, inactive, requestWriteAccess } = botApp;
  const baseApp = buildApiBotApp(app);
  if (!baseApp) return undefined;

  return {
    ...baseApp,
    isInactive: inactive,
    shouldRequestWriteAccess: requestWriteAccess,
  };
}
