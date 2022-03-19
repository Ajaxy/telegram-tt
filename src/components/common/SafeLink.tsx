import React, { FC, memo, useCallback } from '../../lib/teact/teact';
import { getDispatch } from '../../modules';
import convertPunycode from '../../lib/punycode';

import {
  DEBUG, RE_TG_LINK, RE_TME_LINK,
} from '../../config';
import buildClassName from '../../util/buildClassName';
import { ensureProtocol } from '../../util/ensureProtocol';

type OwnProps = {
  url?: string;
  text: string;
  className?: string;
  children?: React.ReactNode;
  isRtl?: boolean;
};

const SafeLink: FC<OwnProps> = ({
  url,
  text,
  className,
  children,
  isRtl,
}) => {
  const { toggleSafeLinkModal, openTelegramLink } = getDispatch();

  const content = children || text;
  const isNotSafe = url !== content;

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (
      e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
      || !url || (!url.match(RE_TME_LINK) && !url.match(RE_TG_LINK))
    ) {
      if (isNotSafe) {
        toggleSafeLinkModal({ url });

        e.preventDefault();
        return false;
      }

      return true;
    }

    e.preventDefault();
    openTelegramLink({ url });

    return false;
  }, [isNotSafe, openTelegramLink, toggleSafeLinkModal, url]);

  if (!url) {
    return undefined;
  }

  const classNames = buildClassName(
    className || 'text-entity-link',
    text.length > 50 && 'long-word-break-all',
  );

  return (
    <a
      href={ensureProtocol(url)}
      title={getDomain(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={classNames}
      onClick={handleClick}
      dir={isRtl ? 'rtl' : 'auto'}
    >
      {content}
    </a>
  );
};

function getDomain(url?: string) {
  if (!url) {
    return undefined;
  }

  const href = ensureProtocol(url);
  if (!href) {
    return undefined;
  }

  try {
    let decodedHref = decodeURI(href);

    const match = decodedHref.match(/^https?:\/\/([^/:?#]+)(?:[/:?#]|$)/i);
    if (!match) {
      return undefined;
    }
    const domain = match[1];
    decodedHref = decodedHref.replace(domain, convertPunycode(domain));

    return decodedHref;
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('SafeLink.getDecodedUrl error ', url, error);
    }
  }

  return undefined;
}

export default memo(SafeLink);
