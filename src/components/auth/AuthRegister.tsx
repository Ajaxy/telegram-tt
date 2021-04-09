import { ChangeEvent } from 'react';
import React, { FC, useState, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState, GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';

import Button from '../ui/Button';
import InputText from '../ui/InputText';
import AvatarEditable from '../ui/AvatarEditable';

type StateProps = Pick<GlobalState, 'authIsLoading' | 'authError'>;
type DispatchProps = Pick<GlobalActions, 'signUp' | 'clearAuthError' | 'uploadProfilePhoto'>;

const AuthRegister: FC<StateProps & DispatchProps> = ({
  authIsLoading, authError, signUp, clearAuthError, uploadProfilePhoto,
}) => {
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
          <h2>Your Name</h2>
          <p className="note">
            Enter your name and add
            <br />a profile picture.
          </p>
          <InputText
            id="registration-first-name"
            label="Name"
            onChange={handleFirstNameChange}
            value={firstName}
            error={authError}
            autoComplete="given-name"
          />
          <InputText
            id="registration-last-name"
            label="Last Name (optional)"
            onChange={handleLastNameChange}
            value={lastName}
            autoComplete="family-name"
          />
          {isButtonShown && (
            <Button type="submit" ripple isLoading={authIsLoading}>Start Messaging</Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authIsLoading', 'authError']),
  (setGlobal, actions): DispatchProps => pick(actions, ['signUp', 'clearAuthError', 'uploadProfilePhoto']),
)(AuthRegister));
