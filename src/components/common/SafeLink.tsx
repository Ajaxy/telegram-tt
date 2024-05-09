import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ApiMessageEntityTypes } from '../../api/types';

import {
  DEBUG,
} from '../../config';
import convertPunycode from '../../lib/punycode';
import buildClassName from '../../util/buildClassName';
import { ensureProtocol } from '../../util/ensureProtocol';

import useLastCallback from '../../hooks/useLastCallback';

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
  const { openUrl } = getActions();

  const content = children || text;
  const isSafe = url === text;

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!url) return true;

    e.preventDefault();
    openUrl({ url, shouldSkipModal: isSafe });

    return false;
  });

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

function getUnicodeUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  const href = ensureProtocol(url);
  if (!href) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(href);
    const unicodeDomain = convertPunycode(parsedUrl.hostname);

    try {
      return decodeURI(parsedUrl.toString()).replace(parsedUrl.hostname, unicodeDomain);
    } catch (err) { // URL contains invalid sequences, keep it as it is
      return parsedUrl.toString().replace(parsedUrl.hostname, unicodeDomain);
    }
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('SafeLink.getDecodedUrl error ', url, error);
    }
  }

  return undefined;
}

export default memo(SafeLink);
