import { Api as GramJs } from '../../../lib/gramjs';
import type {
  ApiAttachMenuBot,
  ApiAttachMenuBotIcon,
  ApiAttachMenuPeerType,
  ApiBotCommand,
  ApiBotInfo,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotMenuButton,
  ApiInlineResultType,
} from '../../types';

import { pick } from '../../../util/iteratees';
import { buildApiPhoto, buildApiThumbnailFromStripped } from './common';
import { buildApiDocument, buildApiWebDocument, buildVideoFromDocument } from './messages';
import { buildStickerFromDocument } from './symbols';
import localDb from '../localDb';
import { buildApiPeerId } from './peers';
import { omitVirtualClassFields } from './helpers';

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

export function buildApiAttachMenuBot(bot: GramJs.AttachMenuBot): ApiAttachMenuBot {
  return {
    id: bot.botId.toString(),
    hasSettings: bot.hasSettings,
    shortName: bot.shortName,
    peerTypes: bot.peerTypes.map(buildApiAttachMenuPeerType),
    icons: bot.icons.map(buildApiAttachMenuIcon).filter(Boolean),
  };
}

function buildApiAttachMenuPeerType(peerType: GramJs.TypeAttachMenuPeerType): ApiAttachMenuPeerType {
  if (peerType instanceof GramJs.AttachMenuPeerTypeBotPM) return 'bot';
  if (peerType instanceof GramJs.AttachMenuPeerTypePM) return 'private';
  if (peerType instanceof GramJs.AttachMenuPeerTypeChat) return 'chat';
  if (peerType instanceof GramJs.AttachMenuPeerTypeBroadcast) return 'channel';
  if (peerType instanceof GramJs.AttachMenuPeerTypeSameBotPM) return 'self';
  return undefined!; // Never reached
}

function buildApiAttachMenuIcon(icon: GramJs.AttachMenuBotIcon): ApiAttachMenuBotIcon | undefined {
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
