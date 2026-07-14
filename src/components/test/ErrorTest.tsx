import type { FC } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

type OwnProps = {
  parentRand: number;
};

type StateProps = {
  globalRand: number;
};

const ErrorTest: FC<OwnProps & StateProps> = ({ parentRand, globalRand }) => {
  // eslint-disable-next-line no-console
  console.log('rendering `ErrorTest`');

  if (!parentRand || parentRand > 0.8) {
    throw new Error('test error render');
  }

  return (
    <div>
      <h3>
        THIS IS `ErrorTest` Component
      </h3>
      <div>
        <div>
          parent:
          {parentRand}
        </div>
        <div>
          global:
          {globalRand}
        </div>
      </div>
    </div>
  );
};

let firstRender = true;
export default withGlobal<OwnProps>((): Complete<StateProps> => {
  const globalRand = Math.random();

  if (firstRender || globalRand > 0.8) {
    firstRender = false;

    throw new Error('test error `mapStateToProps`');
  }

  return { globalRand };
})(ErrorTest);
