import React, { useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

const TestCleanupOrder = () => {
  const [, setRand] = useState(Math.random());

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('effect 1');

    setTimeout(() => {
      setRand(Math.random());
    }, 3000);

    return () => {
      // eslint-disable-next-line no-console
      console.log('cleanup 1');
    };
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('effect 2');

    return () => {
      // eslint-disable-next-line no-console
      console.log('cleanup 2');
    };
  });

  useLayoutEffect(() => {
    // eslint-disable-next-line no-console
    console.log('layout effect 1');

    return () => {
      // eslint-disable-next-line no-console
      console.log('layout cleanup 1');
    };
  });

  useLayoutEffect(() => {
    // eslint-disable-next-line no-console
    console.log('layout effect 2');

    return () => {
      // eslint-disable-next-line no-console
      console.log('layout cleanup 2');
    };
  });

  return <div>Test</div>;
};

export default TestCleanupOrder;
