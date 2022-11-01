import React from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

import './DotAnimation.scss';

type OwnProps = {
  content: string;
  className?: string;
};

const DotAnimation: FC<OwnProps> = ({ content, className }) => {
  const lang = useLang();
  return (
    <span className={buildClassName('DotAnimation', className)} dir={lang.isRtl ? 'rtl' : 'auto'}>
      {renderText(content)}
      <span className="ellipsis" />
    </span>
  );
};

export default DotAnimation;
