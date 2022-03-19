import { ChangeEvent } from 'react';
import React, { FC, useState, memo } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../modules';

import { GlobalState } from '../../global/types';

import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import InputText from '../ui/InputText';
import AvatarEditable from '../ui/AvatarEditable';

type StateProps = Pick<GlobalState, 'authIsLoading' | 'authError'>;

const AuthRegister: FC<StateProps> = ({
  authIsLoading, authError,
}) => {
  const { signUp, clearAuthError, uploadProfilePhoto } = getDispatch();

  const lang = useLang();
  const [isButtonShown, setIsButtonShown] = useState(false);
  const [croppedFile, setCroppedFile] = useState<File | undefined>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  function handleFirstNameChange(event: ChangeEvent<HTMLInputElement>) {
    if (authError) {
      clearAuthError();
    }

    const { target } = event;

    setFirstName(target.value);
    setIsButtonShown(target.value.length > 0);
  }

  function handleLastNameChange(event: ChangeEvent<HTMLInputElement>) {
    const { target } = event;

    setLastName(target.value);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    signUp({ firstName, lastName });

    if (croppedFile) {
      uploadProfilePhoto({ file: croppedFile });
    }
  }

  return (
    <div id="auth-registration-form" className="custom-scroll">
      <div className="auth-form">
        <form action="" method="post" onSubmit={handleSubmit}>
          <AvatarEditable onChange={setCroppedFile} />
          <h2>{lang('YourName')}</h2>
          <p className="note">{lang('Login.Register.Desc')}</p>
          <InputText
            id="registration-first-name"
            label={lang('Login.Register.FirstName.Placeholder')}
            onChange={handleFirstNameChange}
            value={firstName}
            error={authError && lang(authError)}
            autoComplete="given-name"
          />
          <InputText
            id="registration-last-name"
            label={lang('Login.Register.LastName.Placeholder')}
            onChange={handleLastNameChange}
            value={lastName}
            autoComplete="family-name"
          />
          {isButtonShown && (
            <Button type="submit" ripple isLoading={authIsLoading}>{lang('Next')}</Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authIsLoading', 'authError']),
)(AuthRegister));
