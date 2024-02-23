import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './Separator.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
};

function Separator({ children, className }: OwnProps) {
  const lang = useLang();

  return (
    <div
      dir={lang.isRtl ? 'rtl' : undefined}
      className={buildClassName(styles.separator, className)}
    >
      {children}
    </div>
  );
}

export default Separator;
