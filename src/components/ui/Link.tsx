import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

import styles from './Link.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  isRtl?: boolean;
  isPrimary?: boolean;
  withMultilineFix?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Link = ({
  children, isPrimary, className, href, isRtl, withMultilineFix, onClick,
}: OwnProps) => {
  const { openUrl } = getActions();

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (href) openUrl({ url: href });
    onClick?.(e);
  });

  return (
    <a
      href={href || '#'}
      className={buildClassName('Link', styles.link, className, isPrimary && styles.isPrimary)}
      dir={!withMultilineFix ? (isRtl ? 'rtl' : 'auto') : undefined}
      onClick={href || onClick ? handleClick : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
