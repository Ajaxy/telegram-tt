import { useState } from '../../lib/teact/teact';

// 1. Make sure "First line" is rendered even if followed by a component with single text.
// 2. Make sure it then can be normally removed (target is preserved).
// 3. Make sure "Last line" is also rendered.

const Text = () => {
  return 'text component';
};

export function App() {
  const [withFirstLine, setWithFirstLine] = useState(true);

  return (
    <div onClick={() => setWithFirstLine((current) => !current)}>
      {withFirstLine && 'First line'}
      <Text />
      Last line
    </div>
  );
}

export default App;
