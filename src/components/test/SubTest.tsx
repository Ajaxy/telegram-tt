import type { FC } from '../../lib/teact/teact';
import React, { useState } from '../../lib/teact/teact';

import type { ApiUpdateAuthorizationStateType } from '../../api/types';

type OwnProps = {
  authState?: ApiUpdateAuthorizationStateType;
  parentRand: number;
};

const SubTest: FC<OwnProps> = ({ authState, parentRand }) => {
  // eslint-disable-next-line no-console
  console.log('rendering `SubTest`', authState, parentRand);

  const [value, setValue] = useState(0);

  return (
    <div>
      <h3>
        THIS IS `SubTest` Component
      </h3>
      <div>
        authState: {authState}!
      </div>
      <div>
        parentRand: {parentRand}!
      </div>
      <div>
        state value: {value}!
        <input type="button" onClick={() => setValue(value + 1)} value=" + " />
      </div>
    </div>
  );
};

export default SubTest;
