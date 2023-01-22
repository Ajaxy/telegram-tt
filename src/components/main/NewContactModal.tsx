import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiCountryCode, ApiUser, ApiUserStatus } from '../../api/types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { getUserStatus } from '../../global/helpers';
import { selectUser, selectUserStatus } from '../../global/selectors';
import renderText from '../common/helpers/renderText';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Modal from '../ui/Modal';
import Avatar from '../common/Avatar';
import InputText from '../ui/InputText';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';

import './NewContactModal.scss';

const ANIMATION_DURATION = 200;

export type OwnProps = {
  isOpen: boolean;
  userId?: string;
  isByPhoneNumber?: boolean;
};

type StateProps = {
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  phoneCodeList: ApiCountryCode[];
};

const NewContactModal: FC<OwnProps & StateProps> = ({
  isOpen,
  userId,
  isByPhoneNumber,
  user,
  userStatus,
  phoneCodeList,
}) => {
  const { updateContact, importContact, closeNewContactDialog } = getActions();

  const lang = useLang();
  const renderingUser = useCurrentOrPrev(user);
  const renderingIsByPhoneNumber = useCurrentOrPrev(isByPhoneNumber);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  const [firstName, setFirstName] = useState<string>(renderingUser?.firstName ?? '');
  const [lastName, setLastName] = useState<string>(renderingUser?.lastName ?? '');
  const [phone, setPhone] = useState<string>(renderingUser?.phoneNumber ?? '');
  const [shouldSharePhoneNumber, setShouldSharePhoneNumber] = useState<boolean>(true);
  const canBeSubmitted = Boolean(firstName && (!isByPhoneNumber || phone));

  useEffect(() => {
    if (isOpen) {
      markIsShown();
      setFirstName(renderingUser?.firstName ?? '');
      setLastName(renderingUser?.lastName ?? '');
      setPhone(renderingUser?.phoneNumber ?? '');
      setShouldSharePhoneNumber(true);
    }
  }, [isOpen, markIsShown, renderingUser?.firstName, renderingUser?.lastName, renderingUser?.phoneNumber]);

  useEffect(() => {
    if (!IS_TOUCH_ENV && isShown) {
      setTimeout(() => { inputRef.current?.focus(); }, ANIMATION_DURATION);
    }
  }, [isShown]);

  const handleFirstNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumberWithCode(phoneCodeList, e.target.value));
  }, [phoneCodeList]);

  const handleLastNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
  }, []);

  const handleClose = useCallback(() => {
    closeNewContactDialog();
    setFirstName('');
    setLastName('');
    setPhone('');
  }, [closeNewContactDialog]);

  const handleSubmit = useCallback(() => {
    if (isByPhoneNumber || !userId) {
      importContact({
        firstName,
        lastName,
        phoneNumber: phone,
      });
    } else {
      updateContact({
        userId,
        firstName,
        lastName,
        shouldSharePhoneNumber,
      });
    }
  }, [firstName, importContact, isByPhoneNumber, lastName, phone, shouldSharePhoneNumber, updateContact, userId]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  function renderAddContact() {
    return (
      <>
        <div className="NewContactModal__profile" dir={lang.isRtl ? 'rtl' : undefined}>
          <Avatar size="jumbo" user={renderingUser} text={`${firstName} ${lastName}`} />
          <div className="NewContactModal__profile-info">
            <p className="NewContactModal__phone-number">
              {renderingUser?.phoneNumber
                ? formatPhoneNumberWithCode(phoneCodeList, renderingUser.phoneNumber)
                : lang('MobileHidden')}
            </p>
            <span className="NewContactModal__user-status" dir="auto">
              {getUserStatus(lang, renderingUser!, userStatus)}
            </span>
          </div>
        </div>
        <InputText
          ref={inputRef}
          value={firstName}
          label={lang('FirstName')}
          tabIndex={0}
          onChange={handleFirstNameChange}
        />
        <InputText
          value={lastName}
          label={lang('LastName')}
          tabIndex={0}
          onChange={handleLastNameChange}
        />
        <p className="NewContactModal__help-text">
          {renderText(
            lang('NewContact.Phone.Hidden.Text', renderingUser?.firstName || ''),
            ['emoji', 'simple_markdown'],
          )}
        </p>
        <Checkbox
          checked={shouldSharePhoneNumber}
          tabIndex={0}
          onCheck={setShouldSharePhoneNumber}
          label={lang('lng_new_contact_share')}
        />
        <p className="NewContactModal__help-text">
          {renderText(lang('AddContact.SharedContactExceptionInfo', renderingUser?.firstName))}
        </p>
      </>
    );
  }

  function renderCreateContact() {
    return (
      <div className="NewContactModal__new-contact" dir={lang.isRtl ? 'rtl' : undefined}>
        <Avatar size="jumbo" text={`${firstName} ${lastName}`} />
        <div className="NewContactModal__new-contact-fieldset">
          <InputText
            ref={inputRef}
            value={phone}
            inputMode="tel"
            label={lang('lng_contact_phone')}
            tabIndex={0}
            onChange={handlePhoneChange}
          />
          <InputText
            value={firstName}
            label={lang('FirstName')}
            tabIndex={0}
            onChange={handleFirstNameChange}
          />
          <InputText
            value={lastName}
            label={lang('LastName')}
            tabIndex={0}
            onChange={handleLastNameChange}
          />
        </div>
      </div>
    );
  }

  return (
    <Modal
      className="NewContactModal"
      title={lang('NewContact')}
      isOpen={isOpen}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    >
      {renderingUser && renderAddContact()}
      {renderingIsByPhoneNumber && renderCreateContact()}
      <div className="dialog-buttons">
        <Button
          isText
          className="confirm-dialog-button"
          onClick={handleClose}
        >
          {lang('Cancel')}
        </Button>
        <Button
          isText
          className="confirm-dialog-button"
          disabled={!canBeSubmitted}
          onClick={handleSubmit}
        >
          {lang('Done')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    return {
      user: userId ? selectUser(global, userId) : undefined,
      userStatus: userId ? selectUserStatus(global, userId) : undefined,
      phoneCodeList: global.countryList.phoneCodes,
    };
  },
)(NewContactModal));
