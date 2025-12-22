import { memo, useCallback, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { pick } from '../../util/iteratees';

import useLang from '../../hooks/useLang';

import AvatarEditable from '../ui/AvatarEditable';
import Button from '../ui/Button';
import InputText from '../ui/InputText';

type StateProps = {
  auth: GlobalState['auth'];
};

const AuthRegister = ({
  auth,
}: StateProps) => {
  const { signUp, clearAuthErrorKey, uploadProfilePhoto } = getActions();
  const { isLoading, errorKey } = auth;

  const lang = useLang();
  const [isButtonShown, setIsButtonShown] = useState(false);
  const [croppedFile, setCroppedFile] = useState<File | undefined>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleFirstNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (errorKey) {
      clearAuthErrorKey();
    }

    const { target } = event;

    setFirstName(target.value);
    setIsButtonShown(target.value.length > 0);
  }, [errorKey]);

  const handleLastNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    setLastName(target.value);
  }, []);

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
          <p className="note">{lang('LoginRegisterDesc')}</p>
          <InputText
            id="registration-first-name"
            label={lang('LoginRegisterFirstNamePlaceholder')}
            onChange={handleFirstNameChange}
            value={firstName}
            error={errorKey && lang.withRegular(errorKey)}
            autoComplete="given-name"
          />
          <InputText
            id="registration-last-name"
            label={lang('LoginRegisterLastNamePlaceholder')}
            onChange={handleLastNameChange}
            value={lastName}
            autoComplete="family-name"
          />
          {isButtonShown && (
            <Button type="submit" ripple isLoading={isLoading}>{lang('Next')}</Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => (
    pick(global, ['auth'])
  ),
)(AuthRegister));
