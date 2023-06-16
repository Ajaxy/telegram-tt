import React, { useEffect, useRef, useState } from '../../lib/teact/teact';

function TestUpdateRef() {
  const [isShown, setIsShown] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const shownRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Input content should preserve, but ref should clean up
    // eslint-disable-next-line no-console
    console.log('!!!', shownRef.current);
  }, [isShown]);

  return (
    <div onClick={() => setIsShown(!isShown)}>
      {isShown ? (
        <input ref={shownRef} />
      ) : (
        <input />
      )}
    </div>
  );
}

export default TestUpdateRef;
