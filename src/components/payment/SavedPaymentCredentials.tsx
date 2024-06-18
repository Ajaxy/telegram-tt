import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../lib/teact/teact';

import type { ApiPaymentCredentials } from '../../api/types';
import type { FormEditDispatch, FormState } from '../../hooks/reducers/usePaymentReducer';

import { MEMO_EMPTY_ARRAY } from '../../util/memo';

import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import RadioGroup from '../ui/RadioGroup';

interface OwnProps {
  state: FormState;
  savedCredentials?: ApiPaymentCredentials[];
  dispatch: FormEditDispatch;
  onNewCardClick: NoneToVoidFunction;
}

const SavedPaymentCredentials: FC<OwnProps> = ({
  state,
  savedCredentials,
  dispatch,
  onNewCardClick,
}) => {
  const lang = useOldLang();

  const options = useMemo(() => {
    return savedCredentials?.length
      ? savedCredentials.map(({ id, title }) => ({ label: title, value: id }))
      : MEMO_EMPTY_ARRAY;
  }, [savedCredentials]);

  const onChange = useCallback((value) => {
    dispatch({ type: 'changeSavedCredentialId', payload: value });
  }, [dispatch]);

  return (
    <div className="PaymentInfo">
      <form>
        <h5>{lang('PaymentCardTitle')}</h5>

        <RadioGroup
          name="saved-credentials"
          options={options}
          selected={state.savedCredentialId}
          onChange={onChange}
        />

        <Button isText onClick={onNewCardClick}>
          {lang('PaymentCheckoutMethodNewCard')}
        </Button>
      </form>
    </div>
  );
};

export default memo(SavedPaymentCredentials);
