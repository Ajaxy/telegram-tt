import React, { useState } from '../../lib/teact/teact';

export function App() {
  const [trigger, setTrigger] = useState(true);

  return (
    <div
      className="App"
      onClick={() => {
        setTrigger((current) => !current);
      }}
    >
      <h2>Click to update</h2>
      <FragmentContainer items={trigger ? [1, 2, 3] : []} />
      <div>
        This should always go last.
      </div>
    </div>
  );
}

function FragmentContainer({ items }: { items: number[] }) {
  return (
    <>
      {items.map((n) => <div>{n}</div>)}
    </>
  );
}

export default App;
