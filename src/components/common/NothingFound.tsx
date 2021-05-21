import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useShowTransition from '../../hooks/useShowTransition';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import './NothingFound.scss';

interface OwnProps {
  text?: string;
  description?: string;
}

const DEFAULT_TEXT = 'Nothing found.';

const NothingFound: FC<OwnProps> = ({ text = DEFAULT_TEXT, description }) => {
  const lang = useLang();
  const { transitionClassNames } = useShowTransition(true);

  return (
    <div className={buildClassName('NothingFound', transitionClassNames, description && 'with-description')}>
      {text}
      {description && <p className="description">{renderText(lang(description), ['br'])}</p>}
    </div>
  );
};

export default memo(NothingFound);
