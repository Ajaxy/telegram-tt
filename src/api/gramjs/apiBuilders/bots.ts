import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAttachBot,
  ApiAttachBotIcon,
  ApiAttachMenuPeerType,
  ApiBotApp,
  ApiBotAppSettings,
  ApiBotCommand,
  ApiBotInfo,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotInlineSwitchWebview,
  ApiBotMenuButton,
  ApiInlineQueryPeerType,
  ApiInlineResultType,
  ApiKeyboardButton,
  ApiMessagesBotApp,
  ApiReplyKeyboard,
  MediaContainer,
  MediaContent,
} from '../../types';

import { int2hex } from '../../../util/colors';
import { pick } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import { addDocumentToLocalDb } from '../helpers/localDb';
import { serializeBytes } from '../helpers/misc';
import { buildApiMessageEntity, buildApiPhoto } from './common';
import { omitVirtualClassFields } from './helpers';
import {
  buildApiDocument,
  buildApiWebDocument,
  buildAudioFromDocument,
  buildGeoPoint,
  buildVideoFromDocument,
} from './messageContent';
import { buildSvgPath } from './pathBytesToSvg';
import { buildApiPeerId } from './peers';
import { buildStickerFromDocument } from './symbols';

export function buildReplyButtons(
  replyMarkup: GramJs.TypeReplyMarkup | undefined,
  receiptMessageId?: number,
): ApiReplyKeyboard | undefined {
  if (!(replyMarkup instanceof GramJs.ReplyKeyboardMarkup || replyMarkup instanceof GramJs.ReplyInlineMarkup)) {
    return undefined;
  }

  const markup = replyMarkup.rows.map(({ buttons }) => {
    return buttons.map((button): ApiKeyboardButton | undefined => {
      const { text } = button;

      if (button instanceof GramJs.KeyboardButton) {
        return {
          type: 'command',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUrl) {
        if (button.url.includes('?startgroup=')) {
          return {
            type: 'unsupported',
            text,
          };
        }

        return {
          type: 'url',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonCallback) {
        if (button.requiresPassword) {
          return {
            type: 'unsupported',
            text,
          };
        }

        return {
          type: 'callback',
          text,
          data: serializeBytes(button.data),
        };
      }

      if (button instanceof GramJs.KeyboardButtonRequestPoll) {
        return {
          type: 'requestPoll',
          text,
          isQuiz: button.quiz,
        };
      }

      if (button instanceof GramJs.KeyboardButtonRequestPhone) {
        return {
          type: 'requestPhone',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonBuy) {
        if (receiptMessageId) {
          return {
            type: 'receipt',
            receiptMessageId,
          };
        }
        return {
          type: 'buy',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonGame) {
        return {
          type: 'game',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonSwitchInline) {
        return {
          type: 'switchBotInline',
          text,
          query: button.query,
          isSamePeer: button.samePeer,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUserProfile) {
        return {
          type: 'userProfile',
          text,
          userId: button.userId.toString(),
        };
      }

      if (button instanceof GramJs.KeyboardButtonSimpleWebView) {
        return {
          type: 'simpleWebView',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonWebView) {
        return {
          type: 'webView',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUrlAuth) {
        return {
          type: 'urlAuth',
          text,
          url: button.url,
          buttonId: button.buttonId,
        };
      }

      if (button instanceof GramJs.KeyboardButtonCopy) {
        return {
          type: 'copy',
          text,
          copyText: button.copyText,
        };
      }

      return {
        type: 'unsupported',
        text,
      };
    }).filter(Boolean);
  });

  if (markup.every((row) => !row.length)) return undefined;

  return {
    [replyMarkup instanceof GramJs.ReplyKeyboardMarkup ? 'keyboardButtons' : 'inlineButtons']: markup,
    ...(replyMarkup instanceof GramJs.ReplyKeyboardMarkup && {
      keyboardPlaceholder: replyMarkup.placeholder,
      isKeyboardSingleUse: replyMarkup.singleUse,
      isKeyboardSelective: replyMarkup.selective,
    }),
  };
}

export function buildBotInlineMessage(
  sendMessage: GramJs.TypeBotInlineMessage, type: string, document?: GramJs.TypeDocument, photo?: GramJs.TypePhoto,
): MediaContainer & { replyMarkup?: ApiReplyKeyboard } {
  const content: MediaContent = {};

  if (sendMessage instanceof GramJs.BotInlineMessageText) {
    content.text = {
      text: sendMessage.message,
      entities: sendMessage.entities?.map(buildApiMessageEntity),
    };
  } else if (sendMessage instanceof GramJs.BotInlineMessageMediaAuto) {
    if (type === 'photo' && photo instanceof GramJs.Photo) {
      content.photo = buildApiPhoto(photo);
    } else if (type === 'audio' && document instanceof GramJs.Document) {
      content.audio = buildAudioFromDocument(document);
    } else if (type === 'video' && document instanceof GramJs.Document) {
      content.video = buildVideoFromDocument(document);
    } else if (type === 'sticker' && document instanceof GramJs.Document) {
      content.sticker = buildStickerFromDocument(document);
    } else if (type === 'file' && document instanceof GramJs.Document) {
      content.document = buildApiDocument(document);
    } else if (type === 'gif' && document instanceof GramJs.Document) {
      content.video = buildVideoFromDocument(document);
    } else {
      content.text = {
        text: sendMessage.message,
        entities: sendMessage.entities?.map(buildApiMessageEntity),
      };
    }
  } else if (sendMessage instanceof GramJs.BotInlineMessageMediaGeo) {
    content.location = {
      mediaType: 'geo',
      geo: buildGeoPoint(sendMessage.geo)!,
    };
  } else if (sendMessage instanceof GramJs.BotInlineMessageMediaVenue) {
    content.location = {
      mediaType: 'venue',
      geo: buildGeoPoint(sendMessage.geo)!,
      title: sendMessage.title,
      address: sendMessage.address,
      provider: sendMessage.provider,
      venueId: sendMessage.venueId,
      venueType: sendMessage.venueType,
    };
  } else if (sendMessage instanceof GramJs.BotInlineMessageMediaContact) {
    content.contact = {
      mediaType: 'contact',
      phoneNumber: sendMessage.phoneNumber,
      firstName: sendMessage.firstName,
      lastName: sendMessage.lastName,
      userId: '0',
    };
  } else if (sendMessage instanceof GramJs.BotInlineMessageMediaInvoice) {
    content.invoice = {
      mediaType: 'invoice',
      isTest: sendMessage.test,
      title: sendMessage.title,
      description: sendMessage.description,
      photo: buildApiWebDocument(sendMessage.photo),
      currency: sendMessage.currency,
      amount: toJSNumber(sendMessage.totalAmount),
    };
  }

  return {
    content,
    replyMarkup: buildReplyButtons(sendMessage.replyMarkup) || undefined,
  };
}

export function buildApiBotInlineResult(result: GramJs.BotInlineResult, queryId: string): ApiBotInlineResult {
  const {
    id, type, title, description, url, thumb, content, sendMessage,
  } = result;

  return {
    id,
    queryId,
    type: type as ApiInlineResultType,
    sendMessage: buildBotInlineMessage(sendMessage, type),
    title,
    description,
    url,
    content: buildApiWebDocument(content),
    webThumbnail: buildApiWebDocument(thumb),
  };
}

export function buildApiBotInlineMediaResult(
  result: GramJs.BotInlineMediaResult, queryId: string,
): ApiBotInlineMediaResult {
  const {
    id, type, title, description, sendMessage, photo, document,
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
    ...(type === 'file' && document instanceof GramJs.Document && { document: buildApiDocument(document) }),
    ...(type === 'audio' && document instanceof GramJs.Document && { audio: buildAudioFromDocument(document) }),
    ...(type === 'video' && document instanceof GramJs.Document && { video: buildVideoFromDocument(document) }),
    sendMessage: buildBotInlineMessage(sendMessage, type, document, photo),
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
    attachMenuPeerTypes: bot.peerTypes && buildApiAttachMenuPeerType(bot.peerTypes),
    icons: bot.icons.map(buildApiAttachMenuIcon).filter(Boolean),
    isInactive: bot.inactive,
    isDisclaimerNeeded: bot.sideMenuDisclaimerNeeded,
  };
}

function buildApiAttachMenuPeerType(peerTypes: GramJs.TypeAttachMenuPeerType[]): ApiAttachMenuPeerType[] {
  return peerTypes.flatMap((peerType) => {
    if (peerType instanceof GramJs.AttachMenuPeerTypeBotPM) return ['bots'];
    if (peerType instanceof GramJs.AttachMenuPeerTypePM) return ['users'];
    if (peerType instanceof GramJs.AttachMenuPeerTypeChat) return ['chats', 'groups'];
    if (peerType instanceof GramJs.AttachMenuPeerTypeBroadcast) return ['channels'];
    if (peerType instanceof GramJs.AttachMenuPeerTypeSameBotPM) return ['self'];
    return [];
  });
}

function buildApiAttachMenuIcon(icon: GramJs.AttachMenuBotIcon): ApiAttachBotIcon | undefined {
  if (!(icon.icon instanceof GramJs.Document)) return undefined;

  const document = buildApiDocument(icon.icon);

  if (!document) return undefined;

  addDocumentToLocalDb(icon.icon);

  return {
    name: icon.name,
    document,
  };
}

export function buildApiBotInfo(botInfo: GramJs.BotInfo, chatId: string): ApiBotInfo {
  const {
    description, descriptionPhoto, descriptionDocument, userId, commands, menuButton, privacyPolicyUrl,
    hasPreviewMedias, appSettings,
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
    privacyPolicyUrl,
    commands: commandsArray?.length ? commandsArray : undefined,
    hasPreviewMedia: hasPreviewMedias,
    appSettings: appSettings && buildBotAppSettings(appSettings),
  };
}

export function buildBotAppSettings(settings: GramJs.BotAppSettings): ApiBotAppSettings {
  const placeholderPath = settings.placeholderPath && buildSvgPath(settings.placeholderPath);
  return {
    backgroundColor: settings.backgroundColor ? int2hex(settings.backgroundColor) : undefined,
    backgroundDarkColor: settings.backgroundDarkColor ? int2hex(settings.backgroundDarkColor) : undefined,
    headerColor: settings.headerColor ? int2hex(settings.headerColor) : undefined,
    headerDarkColor: settings.headerDarkColor ? int2hex(settings.headerDarkColor) : undefined,
    placeholderPath,
  };
}

export function buildApiBotCommand(botId: string, command: GramJs.BotCommand): ApiBotCommand {
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

export function buildApiInlineQueryPeerType(peerType: GramJs.TypeInlineQueryPeerType): ApiInlineQueryPeerType {
  if (peerType instanceof GramJs.InlineQueryPeerTypeBotPM) return 'bots';
  if (peerType instanceof GramJs.InlineQueryPeerTypePM) return 'users';
  if (peerType instanceof GramJs.InlineQueryPeerTypeChat) return 'chats';
  if (peerType instanceof GramJs.InlineQueryPeerTypeMegagroup) return 'supergroups';
  if (peerType instanceof GramJs.InlineQueryPeerTypeBroadcast) return 'channels';
  if (peerType instanceof GramJs.InlineQueryPeerTypeSameBotPM) return 'self';
  return undefined!; // Never reached
}
