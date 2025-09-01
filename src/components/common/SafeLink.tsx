import type { TeactNode } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ThreadId } from '../../types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import { ensureProtocol, getUnicodeUrl, isMixedScriptUrl } from '../../util/browser/url';
import buildClassName from '../../util/buildClassName';
import { isDeepLink, tryParseDeepLink } from '../../util/deepLinkParser';

import useLastCallback from '../../hooks/useLastCallback';

type OwnProps = {
  url?: string;
  text: string;
  className?: string;
  children?: TeactNode;
  isRtl?: boolean;
  shouldSkipModal?: boolean;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
};

const SafeLink = ({
  url,
  text,
  className,
  children,
  isRtl,
  shouldSkipModal,
  chatId,
  messageId,
  threadId,
}: OwnProps) => {
  const { focusMessage, openUrl } = getActions();

  const content = children || text;
  const isRegularLink = url === text;

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!url) return true;

    e.preventDefault();
    if (chatId && messageId && isDeepLink(url)) {
      const parsedLink = tryParseDeepLink(url);
      if (parsedLink?.type === 'privateMessageLink') {
        const targetChatId = parsedLink.channelId;

        const parsedThreadId = parsedLink.threadId || MAIN_THREAD_ID as ThreadId;

        const isWithinSameChat = chatId === targetChatId && threadId === parsedThreadId;

        if (isWithinSameChat && parsedLink.messageId) {
          focusMessage({
            chatId: targetChatId,
            threadId: parsedThreadId,
            messageId: parsedLink.messageId,
            replyMessageId: messageId,
            timestamp: parsedLink.timestamp,
          });
          return false;
        }
      }
    }

    const isTrustedLink = isRegularLink && !isMixedScriptUrl(url);
    openUrl({ url, shouldSkipModal: shouldSkipModal || isTrustedLink });

    return false;
  });

  if (!url) {
    return undefined;
  }

  const classNames = buildClassName(
    className || 'text-entity-link',
    isRegularLink && 'word-break-all',
  );

  return (
    <a
      href={ensureProtocol(url)}
      title={getUnicodeUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={classNames}
      onClick={handleClick}
      dir={isRtl ? 'rtl' : 'auto'}
      data-entity-type={ApiMessageEntityTypes.Url}
    >
      {content}
    </a>
  );
};

export default SafeLink;
