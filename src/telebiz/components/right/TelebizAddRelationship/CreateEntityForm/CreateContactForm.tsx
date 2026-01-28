import { memo, useCallback, useEffect, useRef, useState } from '@teact';

import buildClassName from '../../../../../util/buildClassName';
import { disableDirectTextInput, enableDirectTextInput } from '../../../../../util/directInputManager';
import { type CreateProviderEntityData } from '../../../../services';

import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import InputText from '../../../../../components/ui/InputText';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  initialName: string;
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  error?: string;
}

const CreateContactForm = ({
  initialName,
  onCreate,
  error,
}: OwnProps) => {
  const nameRef = useRef<HTMLInputElement | undefined>(undefined);

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const lang = useTelebizLang();

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (nameRef.current) {
      nameRef.current.focus();
    }
  }, [nameRef]);

  const clearForm = useCallback(() => {
    setName('');
    setEmail('');
    setPhone('');
  }, []);

  const isFormValid = useCallback(() => {
    return name.length > 0;
  }, [name]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid()) return;
    setIsLoading(true);
    try {
      const createData: Partial<CreateProviderEntityData> = {
        email,
        phone,
        name,
      };
      await onCreate(createData);
      clearForm();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [name, email, phone, onCreate, clearForm, isFormValid, setIsLoading]);

  return (
    <form
      onSubmit={handleCreate}
      onFocus={() => disableDirectTextInput()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          enableDirectTextInput();
        }
      }}
    >
      <div className={styles.formContent}>
        <InputText
          value={name}
          onChange={(e) => setName(e.target.value)}
          label="Name"
          className={buildClassName(styles.formField, 'input-group')}
          ref={nameRef}
        />
        <InputText
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          label="Email"
          className={buildClassName(styles.formField, 'input-group')}
        />
        <InputText
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          label="Phone"
          className={buildClassName(styles.formField, 'input-group')}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <FloatingActionButton
        isShown={name.length > 0}
        onClick={handleCreate}
        disabled={isLoading || !name}
        ariaLabel={lang('Create')}
        iconName="check"
        isLoading={isLoading}
      />
    </form>
  );
};

export default memo(CreateContactForm);
