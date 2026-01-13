import { useState } from '../../lib/teact/teact';

import useInterval from '../../hooks/schedulers/useInterval';

export function App() {
  const [stateValue, setStateValue] = useState(false);

  return (
    <div
      className="App"
      onClick={() => {
        setStateValue((current) => !current);
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" version="1.1">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:rgb(0,255,0);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(0,0,255);stop-opacity:1" />
          </linearGradient>
        </defs>

        {stateValue && (
          <circle
            cx="75"
            cy="75"
            r="50"
            stroke-dasharray="85 20"
            stroke="#dddddd"
            stroke-linecap="round"
            stroke-width="10"
            fill="none"
          />
        )}

        <circle
          cx="75"
          cy="75"
          r="50"
          className="shared-canvas-container"
          stroke-dashoffset={stateValue ? '140' : '0'}
          stroke-dasharray={stateValue ? '85 160' : '85 1000'}
          stroke="url(#grad1)"
          stroke-linecap="round"
          stroke-width="10"
          fill="none"
        />

        <NestedSvg />

        <>
          <rect x="0" y="0" width="50" height="50" fill="blue" />
          <rect x="50" y="0" width="50" height="50" fill={stateValue ? 'red' : 'green'} />
        </>
      </svg>
    </div>
  );
}

function NestedSvg() {
  const [stateValue, setStateValue] = useState(false);

  useInterval(() => {
    setStateValue((current) => !current);
  }, 1000);

  return (
    <circle
      cx="60"
      cy="60"
      r="10"
      fill={stateValue ? 'red' : 'blue'}
    />
  );
}

export default App;
