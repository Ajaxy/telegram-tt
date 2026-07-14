import type { FC } from '../../lib/teact/teact';
import { getGlobal, setGlobal, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

document.ondblclick = () => {
  const value = Math.random();
  let global = getGlobal();
  global = {
    ...global,
    bValue: value,
    aValue: value,
  } as any;
  setGlobal(global);
};

type AStateProps = Pick<GlobalState, 'isSyncing'> & {
  aValue: number;
};

type BStateProps = Pick<GlobalState, 'isSyncing'> & {
  bValue: number;
  derivedAValue: number;
};

type BOwnProps = Pick<GlobalState, 'isSyncing'> & {
  aValue: number;
};

const TestB: FC<BStateProps & BOwnProps> = ({ bValue, aValue, derivedAValue }) => {
  // eslint-disable-next-line no-console
  console.log('!!! B MOUNT ', { bValue, aValue, derivedAValue });

  return (
    <div className="TestB">
      <h2>B</h2>
      <div>
        bValue =
        {' '}
        {bValue}
      </div>
      <div>
        aValue =
        {' '}
        {aValue}
      </div>
      <div>
        derivedAValue =
        {' '}
        {derivedAValue}
      </div>
      {bValue > 0.5 ? (
        <span key="hello" className="hello">Hello</span>
      ) : (
        <span key="world" className="world">World</span>
      )}
    </div>
  );
};

const TestBContainer = withGlobal<BOwnProps>(
  (global, { aValue }): BStateProps => {
    // eslint-disable-next-line no-console
    console.log('!!! B MAP', { aValue });

    return {
      // @ts-ignore
      bValue: global.bValue,
      derivedAValue: (aValue || 0) + 1,
    };
  },
)(TestB);

const TestA: FC<AStateProps> = ({ aValue }) => {
  // eslint-disable-next-line no-console
  console.log('!!! A MOUNT ', { aValue });

  return (
    <div>
      <h1>A</h1>
      <div>
        aValue =
        {' '}
        {aValue}
      </div>
      <TestBContainer aValue={aValue} />
    </div>
  );
};

export default withGlobal(
  (global): AStateProps => {
    // @ts-ignore
    // eslint-disable-next-line no-console
    console.log('!!! A MAP', { aValue: global.aValue });

    return {
      // @ts-ignore
      aValue: global.aValue,
    };
  },
)(TestA);
