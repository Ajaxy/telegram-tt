import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiCountryCode, ApiUser, ApiUserStatus } from '../../api/types';

import { getUserStatus } from '../../global/helpers';
import { selectUser, selectUserFullInfo, selectUserStatus } from '../../global/selectors';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import { DEFAULT_MAX_NOTE_LENGTH } from '../../limits';
import renderText from '../common/helpers/renderText';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Avatar from '../common/Avatar';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Modal from '../ui/Modal';
import TextArea from '../ui/TextArea';

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
  contactNoteLimit: number;
  noteText?: string;
};

const NewContactModal: FC<OwnProps & StateProps> = ({
  isOpen,
  userId,
  isByPhoneNumber,
  user,
  userStatus,
  phoneCodeList,
  contactNoteLimit,
  noteText,
}) => {
  const { updateContact, importContact, closeNewContactDialog } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const renderingUser = useCurrentOrPrev(user);
  const renderingIsByPhoneNumber = useCurrentOrPrev(isByPhoneNumber);
  const inputRef = useRef<HTMLInputElement>();

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  const [firstName, setFirstName] = useState<string>(renderingUser?.firstName ?? '');
  const [lastName, setLastName] = useState<string>(renderingUser?.lastName ?? '');
  const [phone, setPhone] = useState<string>(renderingUser?.phoneNumber ?? '');
  const [note, setNote] = useState<string>('');
  const [shouldSharePhoneNumber, setShouldSharePhoneNumber] = useState<boolean>(true);
  const canBeSubmitted = Boolean(firstName && (!isByPhoneNumber || phone));

  const noteSymbolsLeft = contactNoteLimit - note.length;
  const noteRef = useRef<HTMLTextAreaElement>();

  useEffect(() => {
    if (isOpen) {
      markIsShown();
      setFirstName(renderingUser?.firstName ?? '');
      setLastName(renderingUser?.lastName ?? '');
      setPhone(renderingUser?.phoneNumber ?? '');
      setNote(noteText ?? '');
      setShouldSharePhoneNumber(true);
    }
  }, [isOpen, markIsShown, noteText, renderingUser?.firstName, renderingUser?.lastName, renderingUser?.phoneNumber]);

  useEffect(() => {
    if (!IS_TOUCH_ENV && isShown) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, ANIMATION_DURATION);
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

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  }, []);

  const handleClose = useCallback(() => {
    closeNewContactDialog();
    setFirstName('');
    setLastName('');
    setPhone('');
    setNote('');
  }, [closeNewContactDialog]);

  const handleSubmit = useCallback(() => {
    const noteToSend = note.trim() ? { text: note, entities: [] } : undefined;

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
        note: noteToSend,
      });
    }
  }, [firstName, importContact, isByPhoneNumber, lastName, note, phone, shouldSharePhoneNumber, updateContact, userId]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  function renderAddContact() {
    return (
      <>
        <div className="NewContactModal__profile" dir={lang.isRtl ? 'rtl' : undefined}>
          <Avatar
            size="jumbo"
            peer={renderingUser}
            text={`${firstName} ${lastName}`}
          />
          <div className="NewContactModal__profile-info">
            <p className="NewContactModal__phone-number">
              {renderingUser?.phoneNumber
                ? formatPhoneNumberWithCode(phoneCodeList, renderingUser.phoneNumber)
                : oldLang('MobileHidden')}
            </p>
            <span className="NewContactModal__user-status" dir="auto">
              {getUserStatus(oldLang, renderingUser!, userStatus)}
            </span>
          </div>
        </div>
        <InputText
          ref={inputRef}
          value={firstName}
          label={oldLang('FirstName')}
          tabIndex={0}
          onChange={handleFirstNameChange}
        />
        <InputText
          value={lastName}
          label={oldLang('LastName')}
          tabIndex={0}
          onChange={handleLastNameChange}
        />
        <TextArea
          ref={noteRef}
          id="user-note"
          label={lang('UserNoteTitle')}
          onChange={handleNoteChange}
          value={note}
          maxLength={contactNoteLimit}
          maxLengthIndicator={noteSymbolsLeft.toString()}
          noReplaceNewlines
        />
        <p className="NewContactModal__help-text NewContactModal__help-text__edit">
          {lang('EditUserNoteHint')}
        </p>
        <p className="NewContactModal__help-text">
          {renderText(
            oldLang('NewContact.Phone.Hidden.Text', renderingUser?.firstName || ''),
            ['emoji', 'simple_markdown'],
          )}
        </p>
        <Checkbox
          className="dialog-checkbox"
          checked={shouldSharePhoneNumber}
          tabIndex={0}
          onCheck={setShouldSharePhoneNumber}
          label={oldLang('lng_new_contact_share')}
        />
        <p className="NewContactModal__help-text NewContactModal__help-text__negative">
          {renderText(oldLang('AddContact.SharedContactExceptionInfo', renderingUser?.firstName))}
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
            label={oldLang('lng_contact_phone')}
            tabIndex={0}
            onChange={handlePhoneChange}
          />
          <InputText
            value={firstName}
            label={oldLang('FirstName')}
            tabIndex={0}
            onChange={handleFirstNameChange}
          />
          <InputText
            value={lastName}
            label={oldLang('LastName')}
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
      title={oldLang('NewContact')}
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
          disabled={!canBeSubmitted}
          onClick={handleSubmit}
        >
          {oldLang('Done')}
        </Button>
        <Button
          isText
          className="confirm-dialog-button"
          onClick={handleClose}
        >
          {oldLang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const user = userId ? selectUser(global, userId) : undefined;
    const userFullInfo = userId ? selectUserFullInfo(global, userId) : undefined;
    const contactNoteLimit = global.appConfig?.contactNoteLimit || DEFAULT_MAX_NOTE_LENGTH;

    return {
      user,
      userStatus: userId ? selectUserStatus(global, userId) : undefined,
      phoneCodeList: global.countryList.phoneCodes,
      contactNoteLimit,
      noteText: userFullInfo?.note?.text,
    };
  },
)(NewContactModal));
