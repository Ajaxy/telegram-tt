import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import { ApiMessage, ApiWebPage } from '../../api/types';

import {
  getFirstLinkInMessage, getMessageText,
  getMessageWebPage,
} from '../../modules/helpers';
import buildClassName from '../../util/buildClassName';
import trimText from '../../util/trimText';
import renderText from './helpers/renderText';
import { formatPastTimeShort } from '../../util/dateFormat';
import useLang from '../../hooks/useLang';
import { renderMessageSummary, TextPart } from './helpers/renderMessageText';

import Media from './Media';
import Link from '../ui/Link';
import SafeLink from './SafeLink';

import './WebLink.scss';

const MAX_TEXT_LENGTH = 170; // symbols

type OwnProps = {
  message: ApiMessage;
  senderTitle?: string;
  isProtected?: boolean;
  onMessageClick: (messageId: number, chatId: string) => void;
};

type ApiWebPageWithFormatted = ApiWebPage & { formattedDescription?: TextPart[] };

const WebLink: FC<OwnProps> = ({
  message, senderTitle, isProtected, onMessageClick,
}) => {
  const lang = useLang();

  let linkData: ApiWebPageWithFormatted | undefined = getMessageWebPage(message);

  if (!linkData) {
    const link = getFirstLinkInMessage(message);
    if (link) {
      const { url, domain } = link;

      linkData = {
        siteName: domain.replace(/^www./, ''),
        url: url.includes('://') ? url : url.includes('@') ? `mailto:${url}` : `http://${url}`,
        formattedDescription: getMessageText(message) !== url
          ? renderMessageSummary(lang, message, undefined, undefined, MAX_TEXT_LENGTH, true)
          : undefined,
      } as ApiWebPageWithFormatted;
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
    formattedDescription,
    photo,
    video,
  } = linkData;

  const truncatedDescription = !senderTitle && description && trimText(description, MAX_TEXT_LENGTH);

  const className = buildClassName(
    'WebLink scroll-item',
    (!photo && !video) && 'without-media',
  );

  return (
    <div
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {photo && (
        <Media message={message} isProtected={isProtected} />
      )}
      <div className="content">
        <Link isRtl={lang.isRtl} className="site-title" onClick={handleMessageClick}>
          {renderText(title || siteName || displayUrl)}
        </Link>
        {(truncatedDescription || formattedDescription) && (
          <Link isRtl={lang.isRtl} className="site-description" onClick={handleMessageClick}>
            {formattedDescription || (truncatedDescription && renderText(truncatedDescription))}
          </Link>
        )}
        <SafeLink
          url={url}
          className="site-name"
          text=""
          isRtl={lang.isRtl}
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
            isRtl={lang.isRtl}
          >
            {formatPastTimeShort(lang, message.date * 1000)}
          </Link>
        </div>
      )}
    </div>
  );
};

export default memo(WebLink);
