import React, { useRef, useState } from '../../lib/teact/teact';

export function App() {
  const [trigger, setTrigger] = useState(false);

  return (
    <div
      className="App"
      onClick={() => {
        setTrigger((current) => !current);
      }}
    >
      <h2>Click to update</h2>
      {trigger ? (
        <>
          <span>fragment</span>
          <span>content</span>
        </>
      ) : undefined}
      <Child />
    </div>
  );
}

function Child() {
  const idRef = useRef(String(Math.random()).slice(-4));

  return (
    <div>
      This number should never change: {idRef.current}
    </div>
  );
}

export default App;
