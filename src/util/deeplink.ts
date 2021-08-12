import { getDispatch } from '../lib/teact/teactn';

export const processDeepLink = (url: string) => {
  const { protocol, searchParams, pathname } = new URL(url);

  if (protocol !== 'tg:') return;

  const { openChatByUsername, openStickerSetShortName } = getDispatch();

  const method = pathname.replace(/^\/\//, '');
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  switch (method) {
    case 'resolve': {
      const {
        domain,
      } = params;

      if (domain !== 'telegrampassport') {
        openChatByUsername({
          username: domain,
        });
      }
      break;
    }
    case 'privatepost':

      break;
    case 'bg':

      break;
    case 'join':

      break;
    case 'addstickers': {
      const { set } = params;

      openStickerSetShortName({
        stickerSetShortName: set,
      });
      break;
    }
    case 'msg':

      break;
    default:
      // Unsupported deeplink

      break;
  }
};
