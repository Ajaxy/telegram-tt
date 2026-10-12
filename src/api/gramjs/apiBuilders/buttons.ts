import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiInlineButtonAction, ApiReplyButtonAction, ApiRequestPeerType } from '../../types';

import { serializeBytes } from '../helpers/misc';
import { buildApiInlineQueryPeerType } from './bots';
import { omitVirtualClassFields } from './helpers';

export function buildApiReplyButtonAction(type: GramJs.TypeButtonType): ApiReplyButtonAction {
  if (type instanceof GramJs.ButtonTypeDefault) return { type: 'command' };
  if (type instanceof GramJs.ButtonTypeRequestPhone) return { type: 'requestPhone' };
  if (type instanceof GramJs.ButtonTypeRequestPoll) return { type: 'requestPoll', isQuiz: type.quiz };
  if (type instanceof GramJs.ButtonTypeSimpleWebView) return { type: 'simpleWebView', url: type.url };
  if (type instanceof GramJs.ButtonTypeRequestPeer) {
    const peerType = buildApiRequestPeerType(type.peerType);
    if (peerType) {
      return {
        type: 'requestPeer',
        buttonId: type.buttonId,
        maxQuantity: type.maxQuantity,
        peerType,
      };
    }
  }
  return { type: 'unsupported' };
}

function buildApiRequestPeerType(peerType: GramJs.TypeRequestPeerType): ApiRequestPeerType | undefined {
  if (peerType instanceof GramJs.RequestPeerTypeUser) {
    return {
      type: 'user',
      isBot: peerType.bot,
      isPremium: peerType.premium,
    };
  }

  if (peerType instanceof GramJs.RequestPeerTypeChat) {
    return {
      type: 'group',
      isCreator: peerType.creator,
      isBotParticipant: peerType.botParticipant,
      hasUsername: peerType.hasUsername,
      isForum: peerType.forum,
      userAdminRights: peerType.userAdminRights ? omitVirtualClassFields(peerType.userAdminRights) : undefined,
      botAdminRights: peerType.botAdminRights ? omitVirtualClassFields(peerType.botAdminRights) : undefined,
    };
  }

  if (peerType instanceof GramJs.RequestPeerTypeBroadcast) {
    return {
      type: 'channel',
      isCreator: peerType.creator,
      hasUsername: peerType.hasUsername,
      userAdminRights: peerType.userAdminRights ? omitVirtualClassFields(peerType.userAdminRights) : undefined,
      botAdminRights: peerType.botAdminRights ? omitVirtualClassFields(peerType.botAdminRights) : undefined,
    };
  }

  return undefined;
}

export function buildApiInlineButtonAction(type: GramJs.TypeInlineButtonType): ApiInlineButtonAction {
  if (type instanceof GramJs.InlineButtonTypeUrl) return { type: 'url', url: type.url };
  if (type instanceof GramJs.InlineButtonTypeBuy) return { type: 'buy' };
  if (type instanceof GramJs.InlineButtonTypeGame) return { type: 'game' };
  if (type instanceof GramJs.InlineButtonTypeDisabled) return { type: 'disabled' };
  if (type instanceof GramJs.InlineButtonTypeCallback) {
    return { type: 'callback', data: serializeBytes(type.data), requiresPassword: type.requiresPassword };
  }
  if (type instanceof GramJs.InlineButtonTypeSwitchInline) {
    return {
      type: 'switchBotInline',
      query: type.query,
      isSamePeer: type.samePeer,
      peerTypes: type.peerTypes?.map(buildApiInlineQueryPeerType),
    };
  }
  if (type instanceof GramJs.InlineButtonTypeUserProfile) {
    return { type: 'userProfile', userId: String(type.userId) };
  }
  if (type instanceof GramJs.InlineButtonTypeWebView) return { type: 'webView', url: type.url };
  if (type instanceof GramJs.InlineButtonTypeUrlAuth) {
    return { type: 'urlAuth', url: type.url, buttonId: type.buttonId, forwardText: type.fwdText };
  }
  if (type instanceof GramJs.InlineButtonTypeCopy) return { type: 'copy', copyText: type.copyText };
  return { type: 'unsupported' };
}
