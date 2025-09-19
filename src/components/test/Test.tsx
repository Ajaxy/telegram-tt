import type { FC } from '../../lib/teact/teact';
import { useState } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import ErrorTest from './ErrorTest';
import SubTest from './SubTest';

type StateProps = Pick<GlobalState, 'authState'> & {
  globalRand: number;
};

let lastTimeout: number | undefined;

const Test: FC<StateProps> = ({ authState, globalRand }) => {
  // eslint-disable-next-line no-console
  console.log('rendering `Test`', authState, globalRand);

  const [ownRand, setOwnRand] = useState(0);

  if (lastTimeout) {
    clearTimeout(lastTimeout);
    lastTimeout = undefined;
  }

  lastTimeout = window.setTimeout(() => {
    setOwnRand(Math.random());
  }, 3000);

  return (
    <div>
      <h2>Test page</h2>
      <SubTest authState={authState} parentRand={globalRand} />
      <ErrorTest parentRand={ownRand} />
    </div>
  );
};

export default withGlobal(
  (global): Complete<StateProps> => {
    return {
      authState: global.authState,
      globalRand: Math.random(),
    };
  },
)(Test);
