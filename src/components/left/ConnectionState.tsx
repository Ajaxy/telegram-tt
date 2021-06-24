import React, { memo, FC } from '../../lib/teact/teact';

import { GlobalState } from '../../global/types';

import useLang from '../../hooks/useLang';

import Spinner from '../ui/Spinner';

import './ConnectionState.scss';

type StateProps = Pick<GlobalState, 'connectionState'>;

const ConnectionState: FC<StateProps> = () => {
  const lang = useLang();

  return (
    <div id="ConnectionState" dir={lang.isRtl ? 'rtl' : undefined}>
      <Spinner color="black" />
      <div className="state-text">{lang('WaitingForNetwork')}</div>
    </div>
  );
};

export default memo(ConnectionState);
