import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiContact, ApiCountryCode, ApiUser } from '../../../api/types';

import { getCanAddContact, getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import Button from '../../ui/Button';

import styles from './Contact.module.scss';

type OwnProps = {
  contact: ApiContact;
};

type StateProps = {
  user?: ApiUser;
  phoneCodeList: ApiCountryCode[];
};

const UNREGISTERED_CONTACT_ID = '0';

const Contact: FC<OwnProps & StateProps> = ({
  contact, user, phoneCodeList,
}) => {
  const lang = useLang();
  const {
    openChat, openAddContactDialog, showNotification, openChatWithInfo,
  } = getActions();

  const {
    phoneNumber,
    userId,
  } = contact;
  const isRegistered = userId !== UNREGISTERED_CONTACT_ID;
  const canAddContact = isRegistered && user && getCanAddContact(user);

  const handleOpenChat = useLastCallback(() => {
    openChat({ id: userId });
  });

  const handleAddContact = useLastCallback(() => {
    openAddContactDialog({ userId: user?.id });
  });

  const handleClick = useLastCallback(() => {
    if (user) {
      openChatWithInfo({ id: userId });
    } else {
      copyTextToClipboard(phoneNumber);
      showNotification({ message: lang('PhoneCopied') });
    }
  });

  return (
    <PeerColorWrapper peer={user} emojiIconClassName={styles.emojiIconBackground} className={styles.root}>
      <div className={styles.infoContainer} onClick={handleClick}>
        <Avatar size="large" peer={user} text={getContactName(contact)} />
        <div className={styles.info}>
          <div className={styles.name}>
            {user ? getUserFullName(user) : getContactName(contact)}
          </div>
          <div className={styles.phone}>{formatPhoneNumberWithCode(phoneCodeList, phoneNumber)}</div>
        </div>
      </div>
      {isRegistered && (
        <>
          <div className={styles.divider} />
          <div className={styles.buttons}>
            <Button isText color="translucent" ripple onClick={handleOpenChat} className={styles.button}>
              {lang('SharedContactMessage')}
            </Button>
            {canAddContact && (
              <Button isText color="translucent" ripple onClick={handleAddContact} className={styles.button}>
                {lang('SharedContactAdd')}
              </Button>
            )}
          </div>
        </>
      )}
    </PeerColorWrapper>
  );
};

function getContactName(contact: ApiContact) {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName} ${contact.lastName}`;
  }

  if (contact.firstName) {
    return contact.firstName;
  }

  if (contact.lastName) {
    return contact.lastName;
  }

  return '';
}

export default withGlobal<OwnProps>(
  (global, { contact }): StateProps => {
    const { countryList: { phoneCodes: phoneCodeList } } = global;
    const user = selectUser(global, contact.userId);

    return {
      user,
      phoneCodeList,
    };
  },
)(Contact);
