import { useState } from '../../lib/teact/teact';

// 1. Make sure "First line" is rendered even if followed by a component with single text.
// 2. Make sure it then can be normally removed (target is preserved).
// 3. Make sure "Last line" is also rendered.

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <span>
        Count:
        {' '}
        {count}
      </span>
    </div>
  );
};

const STATIC_COUNTER = <Counter />;

export function App() {
  const [withFirstReuse, setWithFirstReuse] = useState(true);
  return (
    <div>
      {withFirstReuse && STATIC_COUNTER}
      <Counter />
      {STATIC_COUNTER}
      <button onClick={() => setWithFirstReuse((current) => !current)}>Toggle first reuse</button>
    </div>
  );
}

export default App;
