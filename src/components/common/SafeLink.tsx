import type { TeactNode } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ThreadId } from '../../types';
import { ApiMessageEntityTypes, type LinkContext } from '../../api/types';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { ensureProtocol, getUnicodeUrl, isMixedScriptUrl } from '../../util/browser/url';
import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

type OwnProps = {
  url?: string;
  text: string;
  className?: string;
  children?: TeactNode;
  isRtl?: boolean;
  shouldSkipModal?: boolean;
  tryInstantView?: boolean;
  previewId?: string;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  entityType?: ApiMessageEntityTypes.Url | ApiMessageEntityTypes.TextUrl |
    `${ApiMessageEntityTypes.TextUrl}` | `${ApiMessageEntityTypes.Url}`;
};

const SafeLink = ({
  url,
  text,
  className,
  children,
  isRtl,
  shouldSkipModal,
  tryInstantView,
  previewId,
  chatId,
  messageId,
  threadId,
  entityType = ApiMessageEntityTypes.Url,
}: OwnProps) => {
  const { openUrl } = getActions();

  const content = children || text;
  const isRegularLink = url === text;

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!url) return true;

    e.preventDefault();

    const isTrustedLink = isRegularLink && !isMixedScriptUrl(url);
    const linkContext: LinkContext | undefined = chatId && messageId
      ? { type: 'message', chatId, threadId, messageId }
      : undefined;
    openUrl({
      url,
      shouldSkipModal: shouldSkipModal || isTrustedLink,
      tryInstant: tryInstantView,
      previewId,
      linkContext,
    });

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
      target={IS_TAURI ? '_self' : '_blank'}
      rel="noopener noreferrer"
      className={classNames}
      onClick={handleClick}
      dir={isRtl ? 'rtl' : 'auto'}
      data-entity-type={entityType}
    >
      {content}
    </a>
  );
};

export default SafeLink;
