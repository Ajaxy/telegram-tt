import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import './NothingFound.scss';

interface OwnProps {
  text?: string;
  description?: string;
}

const DEFAULT_TEXT = 'Nothing found.';

const NothingFound: FC<OwnProps> = ({ text = DEFAULT_TEXT, description }) => {
  const lang = useOldLang();
  const { transitionClassNames } = useShowTransitionDeprecated(true);

  return (
    <div className={buildClassName('NothingFound', transitionClassNames, description && 'with-description')}>
      {text}
      {description && <p className="description">{renderText(lang(description), ['br'])}</p>}
    </div>
  );
};

export default memo(NothingFound);
