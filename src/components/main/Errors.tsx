import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiError } from '../../api/types';

import getReadableErrorText from '../../util/getReadableErrorText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

import './Errors.scss';

type StateProps = {
  errors: ApiError[];
};

type DispatchProps = Pick<GlobalActions, 'dismissError'>;

const Errors: FC<StateProps & DispatchProps> = ({ errors, dismissError }) => {
  const lang = useLang();

  if (!errors.length) {
    return undefined;
  }

  return (
    <div id="Errors">
      {errors.map((error) => (
        <Modal
          isOpen
          onClose={dismissError}
          className="error"
          title={getErrorHeader(error)}
        >
          <p>{getReadableErrorText(error)}</p>
          <Button isText onClick={dismissError}>{lang('OK')}</Button>
        </Modal>
      ))}
    </div>
  );
};

function getErrorHeader(error: ApiError) {
  if (error.isSlowMode) {
    return 'Slowmode enabled';
  }

  return 'Something went wrong';
}

export default memo(withGlobal(
  (global): StateProps => pick(global, ['errors']),
  (setGlobal, actions): DispatchProps => pick(actions, ['dismissError']),
)(Errors));
