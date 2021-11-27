import { getDispatch } from '../lib/teact/teactn';

type DeepLinkMethod = 'resolve' | 'login' | 'passport' | 'settings' | 'join' | 'addstickers' | 'setlanguage' |
'addtheme' | 'confirmphone' | 'socks' | 'proxy' | 'privatepost' | 'bg' | 'share' | 'msg' | 'msg_url';

export const processDeepLink = (url: string) => {
  const { protocol, searchParams, pathname } = new URL(url);

  if (protocol !== 'tg:') return;

  const {
    openChatByInvite,
    openChatByUsername,
    openStickerSetShortName,
    focusMessage,
    joinVoiceChatByLink,
  } = getDispatch();

  const method = pathname.replace(/^\/\//, '') as DeepLinkMethod;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  switch (method) {
    case 'resolve': {
      const {
        domain, post, comment, voicechat, livestream,
      } = params;

      if (domain !== 'telegrampassport') {
        if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
          joinVoiceChatByLink({
            username: domain,
            inviteHash: voicechat || livestream,
          });
        } else {
          openChatByUsername({
            username: domain,
            messageId: Number(post),
            commentId: Number(comment),
          });
        }
      }
      break;
    }
    case 'privatepost': {
      const {
        post, channel,
      } = params;

      focusMessage({
        chatId: -Number(channel),
        id: post,
      });
      break;
    }
    case 'bg': {
      // const {
      //   slug, color, rotation, mode, intensity, bg_color: bgColor, gradient,
      // } = params;
      break;
    }
    case 'join': {
      const { invite } = params;

      openChatByInvite({ hash: invite });
      break;
    }
    case 'addstickers': {
      const { set } = params;

      openStickerSetShortName({
        stickerSetShortName: set,
      });
      break;
    }
    case 'share':
    case 'msg': {
      // const { url, text } = params;
      break;
    }
    case 'login': {
      // const { code, token } = params;
      break;
    }
    default:
      // Unsupported deeplink

      break;
  }
};
