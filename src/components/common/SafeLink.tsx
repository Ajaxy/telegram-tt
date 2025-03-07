import type { TeactNode } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ApiMessageEntityTypes } from '../../api/types';

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
};

const SafeLink = ({
  url,
  text,
  className,
  children,
  isRtl,
  shouldSkipModal,
}: OwnProps) => {
  const { openUrl } = getActions();

  const content = children || text;
  const isRegularLink = url === text;

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!url) return true;

    e.preventDefault();

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
