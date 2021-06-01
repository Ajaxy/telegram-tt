import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import { ApiMessage, ApiWebPage } from '../../api/types';

import { getFirstLinkInMessage, getMessageSummaryText, getMessageWebPage } from '../../modules/helpers';
import buildClassName from '../../util/buildClassName';
import trimText from '../../util/trimText';
import renderText from './helpers/renderText';
import { formatPastTimeShort } from '../../util/dateFormat';
import useLang from '../../hooks/useLang';

import Media from './Media';
import Link from '../ui/Link';
import SafeLink from './SafeLink';

import './WebLink.scss';

const MAX_TEXT_LENGTH = 170; // symbols

type OwnProps = {
  message: ApiMessage;
  senderTitle?: string;
  onMessageClick: (messageId: number, chatId: number) => void;
};

const WebLink: FC<OwnProps> = ({ message, senderTitle, onMessageClick }) => {
  const lang = useLang();

  let linkData: ApiWebPage | undefined = getMessageWebPage(message);

  if (!linkData) {
    const link = getFirstLinkInMessage(message);
    if (link) {
      const { url, domain } = link;
      const messageText = getMessageSummaryText(lang, message);

      linkData = {
        siteName: domain.replace(/^www./, ''),
        url: url.includes('://') ? url : url.includes('@') ? `mailto:${url}` : `http://${url}`,
        description: messageText !== url ? messageText : undefined,
      } as ApiWebPage;
    }
  }

  const handleMessageClick = useCallback(() => {
    onMessageClick(message.id, message.chatId);
  }, [onMessageClick, message.id, message.chatId]);

  if (!linkData) {
    return undefined;
  }

  const {
    siteName,
    url,
    displayUrl,
    title,
    description,
    photo,
  } = linkData;

  const truncatedDescription = !senderTitle && trimText(description, MAX_TEXT_LENGTH);

  const className = buildClassName(
    'WebLink scroll-item',
    !photo && 'without-photo',
  );

  return (
    <div
      className={className}
      data-initial={(siteName || displayUrl)[0]}
    >
      {photo && (
        <Media message={message} />
      )}
      <div className="content">
        <Link className="site-title" onClick={handleMessageClick}>{renderText(title || siteName || displayUrl)}</Link>
        {truncatedDescription && (
          <Link className="site-description" onClick={handleMessageClick}>{renderText(truncatedDescription)}</Link>
        )}
        <SafeLink
          url={url}
          className="site-name"
          text=""
        >
          {url.replace('mailto:', '') || displayUrl}
        </SafeLink>
        {senderTitle && <div className="sender-name">{renderText(senderTitle)}</div>}
      </div>
      {senderTitle && (
        <div className="message-date">
          <Link
            className="date"
            onClick={handleMessageClick}
          >
            {formatPastTimeShort(lang, message.date * 1000)}
          </Link>
        </div>
      )}
    </div>
  );
};

export default memo(WebLink);
