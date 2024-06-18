import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import './DotAnimation.scss';

type OwnProps = {
  content: string;
  className?: string;
};

const DotAnimation: FC<OwnProps> = ({ content, className }) => {
  const lang = useOldLang();
  return (
    <span className={buildClassName('DotAnimation', className)} dir={lang.isRtl ? 'rtl' : 'auto'}>
      {renderText(content)}
      <span className="ellipsis" />
    </span>
  );
};

export default DotAnimation;
