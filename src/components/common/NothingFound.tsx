import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useShowTransition from '../../hooks/useShowTransition';

import './NothingFound.scss';

interface OwnProps {
  text?: string;
}

const DEFAULT_TEXT = 'Nothing found.';

const NothingFound: FC<OwnProps> = ({ text = DEFAULT_TEXT }) => {
  const { transitionClassNames } = useShowTransition(true);

  return (
    <div className={buildClassName('NothingFound', transitionClassNames)}>
      {text}
    </div>
  );
};

export default memo(NothingFound);
