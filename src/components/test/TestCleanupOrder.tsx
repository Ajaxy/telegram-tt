/* eslint-disable no-console */
import { type TeactNode, useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

function Component1({ children }: { children?: TeactNode }) {
  useEffect(() => {
    console.log('Effect 1');
    return () => console.log('Cleanup 1');
  });

  useEffect(() => {
    console.log('Effect 1.2');
    return () => console.log('Cleanup 1.2');
  });

  useLayoutEffect(() => {
    console.log('Layout 1');
    return () => console.log('Layout Cleanup 1');
  });

  useLayoutEffect(() => {
    console.log('Layout 1.2');
    return () => console.log('Layout Cleanup 1.2');
  });
  return children;
}

function Component1B({ children }: { children?: TeactNode }) {
  useEffect(() => {
    console.log('Effect 1b');
    return () => console.log('Cleanup 1b');
  });

  useLayoutEffect(() => {
    console.log('Layout 1b');
    return () => console.log('Layout Cleanup 1b');
  });
  return 'B';
}

function Component2({ children }: { children?: TeactNode }) {
  useEffect(() => {
    console.log('Effect 2');
    return () => console.log('Cleanup 2');
  });

  useLayoutEffect(() => {
    console.log('Layout 2');
    return () => console.log('Layout Cleanup 2');
  });
  return children;
}

function Component3() {
  useEffect(() => {
    console.log('Effect 3');
    return () => console.log('Cleanup 3');
  });

  useLayoutEffect(() => {
    console.log('Layout 3');
    return () => console.log('Layout Cleanup 3');
  });
  return <div>Leaf</div>;
}

function TestCleanupOrder() {
  const [isMounted, setIsMounted] = useState(true);
  return (
    <div style="padding: 1rem" onClick={() => setIsMounted((p) => !p)}>
      {isMounted && (
        <>
          <Component1>
            <Component2>
              <Component3 />
            </Component2>
          </Component1>
          <Component1B />
        </>
      )}
    </div>
  );
}

export default TestCleanupOrder;
