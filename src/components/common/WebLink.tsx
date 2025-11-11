import { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiMessage, ApiWebPage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { TextPart } from '../../types';

import {
  getFirstLinkInMessage,
  getMessageTextWithFallback,
} from '../../global/helpers';
import { selectWebPageFromMessage } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatPastTimeShort } from '../../util/dates/dateFormat';
import trimText from '../../util/trimText';
import { renderMessageSummary } from './helpers/renderMessageText';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Link from '../ui/Link';
import Media from './Media';
import SafeLink from './SafeLink';

import './WebLink.scss';

const MAX_TEXT_LENGTH = 170; // symbols

type ApiWebPageWithFormatted =
  ApiWebPage
  & { formattedDescription?: TextPart[] };

type OwnProps = {
  message: ApiMessage;
  senderTitle?: string;
  isProtected?: boolean;
  observeIntersection?: ObserveFn;
  onMessageClick: (message: ApiMessage) => void;
};

type StateProps = {
  webPage?: ApiWebPage;
};

const WebLink = ({
  message, webPage, senderTitle, isProtected, observeIntersection, onMessageClick,
}: OwnProps & StateProps) => {
  const lang = useLang();
  const oldLang = useOldLang();

  const handleMessageClick = useLastCallback(() => {
    onMessageClick(message);
  });

  let linkData: ApiWebPageWithFormatted | undefined = webPage;

  if (!linkData) {
    const link = getFirstLinkInMessage(message);
    if (link) {
      const { url: linkUrl, domain } = link;

      linkData = {
        mediaType: 'webpage',
        webpageType: 'full',
        id: '',
        displayUrl: linkUrl,
        siteName: domain.replace(/^www./, ''),
        url: linkUrl.includes('://') ? linkUrl : linkUrl.includes('@') ? `mailto:${linkUrl}` : `http://${linkUrl}`,
        formattedDescription: getMessageTextWithFallback(lang, message)?.text !== linkUrl
          ? renderMessageSummary(lang, message, undefined, undefined, MAX_TEXT_LENGTH)
          : undefined,
      } satisfies ApiWebPageWithFormatted;
    }
  }

  const fullLinkData = linkData?.webpageType === 'full' ? linkData : undefined;

  const { url } = linkData || {};

  const fallbackDescription = useMemo(() => {
    return getMessageTextWithFallback(lang, message)?.text !== url
      ? renderMessageSummary(lang, message, undefined, undefined, MAX_TEXT_LENGTH)
      : undefined;
  }, [lang, message, url]);

  const {
    siteName,
    displayUrl,
    title,
    description,
    formattedDescription = fallbackDescription,
    photo,
    video,
  } = fullLinkData || {};

  const siteTitle = useMemo(() => {
    const text = title || siteName || displayUrl;
    if (text) return text;
    if (!url) return '';
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch (e) {
      return '';
    }
  }, [title, siteName, displayUrl, url]);

  if (!url) return undefined;

  const truncatedDescription = !senderTitle && description && trimText(description, MAX_TEXT_LENGTH);

  const className = buildClassName(
    'WebLink scroll-item',
    (!photo && !video) && 'without-media',
  );

  const safeLinkContent = displayUrl || url.replace('mailto:', '');

  return (
    <div
      className={className}
      data-initial={siteTitle[0]}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {photo && (
        <Media message={message} isProtected={isProtected} observeIntersection={observeIntersection} />
      )}
      <div className="content">
        <Link isRtl={lang.isRtl} className="site-title" onClick={handleMessageClick}>
          {renderText(siteTitle)}
        </Link>
        {(truncatedDescription || formattedDescription) && (
          <Link isRtl={lang.isRtl} className="site-description" onClick={handleMessageClick}>
            {formattedDescription || (truncatedDescription && renderText(truncatedDescription))}
          </Link>
        )}
        <SafeLink
          url={url}
          className="site-name"
          text={safeLinkContent}
          isRtl={lang.isRtl}
        />
        {senderTitle && <div className="sender-name">{renderText(senderTitle)}</div>}
      </div>
      {senderTitle && (
        <div className="message-date">
          <Link
            className="date"
            onClick={handleMessageClick}
            isRtl={lang.isRtl}
          >
            {formatPastTimeShort(oldLang, message.date * 1000)}
          </Link>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    message,
  }): Complete<StateProps> => {
    const webPage = selectWebPageFromMessage(global, message);

    return {
      webPage,
    };
  },
)(WebLink));
