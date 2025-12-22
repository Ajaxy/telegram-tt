import { useState } from '../../lib/teact/teact';

import Portal from '../ui/Portal';

const StateChecker = () => {
  const [value, setValue] = useState(0);

  return (
    <div>
      state value:
      {' '}
      {value}
      !
      <input type="button" onClick={() => setValue(value + 1)} value=" + " />
    </div>
  );
};

const TestPortal = () => {
  const [value, setValue] = useState(0);
  const position = 100 + Math.round(Math.random() * 300);

  return (
    <div>
      <h2>Test normal</h2>
      <div>
        state value:
        {' '}
        {value}
        !
        <input type="button" onClick={() => setValue(value + 1)} value=" + " />
      </div>
      <Portal>
        <div
          style={`position: absolute; top: ${position}px; left: ${position}px; width: 250px;`}
        >
          <h2>
            Test portal
          </h2>
          <StateChecker />
        </div>
      </Portal>
    </div>
  );
};

export default TestPortal;
