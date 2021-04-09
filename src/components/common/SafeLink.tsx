import React, { FC, memo, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';
import convertPunycode from '../../lib/punycode';
import { GlobalActions } from '../../global/types';

import { DEBUG, RE_TME_LINK } from '../../config';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

type OwnProps = {
  url?: string;
  text: string;
  className?: string;
  children?: any;
};

type DispatchProps = Pick<GlobalActions, 'openTelegramLink'>;

const SafeLink: FC<OwnProps & DispatchProps> = ({
  url,
  text,
  className,
  children,
  openTelegramLink,
}) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (
      e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
      || !url || !url.match(RE_TME_LINK)
    ) {
      return true;
    }

    e.preventDefault();
    openTelegramLink({ url });

    return false;
  }, [openTelegramLink, url]);

  if (!url) {
    return undefined;
  }

  const classNames = buildClassName(
    className || 'text-entity-link',
    text.length > 50 && 'long-word-break-all',
  );

  return (
    <a
      href={getHref(url)}
      title={getDecodedUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={classNames}
      onClick={handleClick}
    >
      {children || text}
    </a>
  );
};

function getHref(url?: string) {
  if (!url) {
    return undefined;
  }

  return url.includes('://') ? url : `http://${url}`;
}

function getDecodedUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  const href = getHref(url);
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

export default memo(withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['openTelegramLink']),
)(SafeLink));
