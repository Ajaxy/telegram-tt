import React, { FC } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import buildClassName from '../../util/buildClassName';

import './DotAnimation.scss';

type OwnProps = {
  content: string;
  className?: string;
};

const DotAnimation: FC<OwnProps> = ({ content, className }) => {
  const lang = useLang();
  return (
    <span className={buildClassName('DotAnimation', className)} dir={lang.isRtl ? 'rtl' : 'auto'}>
      {content}
      <span className="ellipsis" />
    </span>
  );
};

export default DotAnimation;
