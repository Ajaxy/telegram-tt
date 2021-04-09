import React, { FC } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState } from '../../global/types';

import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Spinner from '../ui/Spinner';

import './ConnectionState.scss';

type StateProps = Pick<GlobalState, 'connectionState'>;

const ConnectionState: FC<StateProps> = ({ connectionState }) => {
  const lang = useLang();

  const isConnecting = connectionState === 'connectionStateConnecting';

  return isConnecting && (
    <div id="ConnectionState">
      <Spinner color="black" />
      <div className="state-text">{lang('WaitingForNetwork')}</div>
    </div>
  );
};

export default withGlobal(
  (global): StateProps => pick(global, ['connectionState']),
)(ConnectionState);
