import React, {
  createContext, memo, useState,
} from '../../lib/teact/teact';

import useContext from '../../hooks/data/useContext';

const TestingContext = createContext('default value');

const ContextConsumer = ({ children, debugKey }: { children?: any; debugKey?: string }) => {
  const value = useContext(TestingContext);
  if (debugKey) {
    // eslint-disable-next-line no-console
    console.log(`ContextConsumer ${debugKey}`, value);
  }
  return (
    <div style="color: red">
      {`Current context value: ${value}`}
      {children}
    </div>
  );
};

const MemoizedWrapper = memo(({ children } : { children: any }) => {
  return <div style="background-color: aquamarine">{children}</div>;
});

const ContextSwapper = ({ value, children } : { value: string; children: any }) => {
  return (
    <div style="border: 1px solid red">
      Swapped {value}
      {children}
    </div>
  );
};

const TestContext = () => {
  const [value, setValue] = useState(Math.random().toString());
  const [isSwapping, setIsSwapping] = useState(false);

  const Wrapper = isSwapping ? ContextSwapper : TestingContext.Provider;
  return (
    <div>
      <button onClick={() => setValue(Math.random().toString())}>Change context value</button>
      <button onClick={() => setIsSwapping((prev) => !prev)}>Swap context wrapper</button>
      <ContextConsumer />
      <Wrapper value={value}>
        <div>
          <ContextConsumer debugKey="A">
            <ContextConsumer debugKey="B">
              <ContextConsumer debugKey="C" />
            </ContextConsumer>
          </ContextConsumer>
        </div>
        <TestingContext.Provider value={`sibling ${value}`}>
          <ContextConsumer />
        </TestingContext.Provider>
        <MemoizedWrapper>
          <ContextConsumer />
        </MemoizedWrapper>
        <>
          <ContextConsumer />
          <ContextConsumer />
        </>
        <TestingContext.Provider value={`fastlist ${value}`}>
          <div style="background-color: antiquewhite" teactFastList>
            <ContextConsumer key="first" />
            {!isSwapping && <div key="second">Fast list item</div>}
            <ContextConsumer key="third" />
          </div>
        </TestingContext.Provider>
        <TestingContext.Provider value="overriden value">
          <ContextConsumer />
        </TestingContext.Provider>
      </Wrapper>
    </div>
  );
};

export default TestContext;
