import React, { useState } from '../../lib/teact/teact';

const INTERACTIVE = 'cursor: pointer; text-decoration: underline;';

const TestA = () => {
  const [shouldRender, setShouldRender] = useState<boolean>(true);

  function handleClick() {
    setShouldRender(false);
    setTimeout(() => {
      setShouldRender(true);
    }, 1000);
  }

  if (!shouldRender) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  return (
    <>
      <span onClick={handleClick} style={INTERACTIVE}>4</span>
      <span onClick={handleClick} style={INTERACTIVE}>5</span>
      <span onClick={handleClick} style={INTERACTIVE}>6</span>
    </>
  );
};

const TestB = () => {
  const [shouldRender, setShouldRender] = useState<boolean>(true);

  function handleClick() {
    setShouldRender(false);
    setTimeout(() => {
      setShouldRender(true);
    }, 1000);
  }

  return (
    <>
      {shouldRender && <span>7</span>}
      <span onClick={handleClick} style={INTERACTIVE}>8</span>
      {shouldRender && (
        <>
          <span>9</span>
          <span>10</span>
        </>
      )}
    </>
  );
};

const TestNoContainer = () => {
  const [aKey, setAKey] = useState(1);

  function handleClick() {
    setAKey((current) => (current === 1 ? 0 : 1));
  }

  return (
    <>
      <span onClick={handleClick} style={INTERACTIVE}>1</span>
      <span>2</span>
      <span>3</span>
      <TestA key={aKey} />
      <TestB />
      <span>11</span>
      <span>12</span>
      <span>13</span>
    </>
  );
};

export default TestNoContainer;
