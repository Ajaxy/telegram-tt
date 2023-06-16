import React, { useEffect, useRef, useState } from '../../lib/teact/teact';

function TestUpdateRef() {
  const [isShown, setIsShown] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Input content should preserve, but ref should clean up
    // eslint-disable-next-line no-console
    console.log('!!!', inputRef.current);

    // Ref should update
    // eslint-disable-next-line no-console
    console.log('!!!', headingRef.current);
  }, [isShown]);

  return (
    <>
      <div onClick={() => setIsShown(!isShown)}>
        {isShown ? (
          <input ref={inputRef} />
        ) : (
          <input />
        )}
      </div>

      <div onClick={() => setIsShown(!isShown)}>
        {isShown ? (
          <h1 ref={headingRef}>Shown</h1>
        ) : (
          <h2 ref={headingRef}>Hidden</h2>
        )}
      </div>
    </>
  );
}

export default TestUpdateRef;
