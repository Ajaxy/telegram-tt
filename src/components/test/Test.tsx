import { useState } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import ErrorTest from './ErrorTest';
import SubTest from './SubTest';

type StateProps = {
  authState: GlobalState['auth']['state'];
  globalRand: number;
};

let lastTimeout: number | undefined;

const Test = ({ authState, globalRand }: StateProps) => {
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
      authState: global.auth.state,
      globalRand: Math.random(),
    };
  },
)(Test);
