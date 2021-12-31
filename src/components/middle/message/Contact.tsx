import React, { FC, useCallback } from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiUser, ApiContact, ApiCountryCode } from '../../../api/types';

import { selectUser } from '../../../modules/selectors';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import buildClassName from '../../../util/buildClassName';

import Avatar from '../../common/Avatar';

import './Contact.scss';

type OwnProps = {
  contact: ApiContact;
};

type StateProps = {
  user?: ApiUser;
  phoneCodeList: ApiCountryCode[];
};

const Contact: FC<OwnProps & StateProps> = ({
  contact, user, phoneCodeList,
}) => {
  const { openUserInfo } = getDispatch();

  const {
    firstName,
    lastName,
    phoneNumber,
    userId,
  } = contact;

  const handleClick = useCallback(() => {
    openUserInfo({ id: userId });
  }, [openUserInfo, userId]);

  return (
    <div
      className={buildClassName('Contact', Boolean(userId) && 'interactive')}
      onClick={userId ? handleClick : undefined}
    >
      <Avatar size="large" user={user} text={firstName || lastName} />
      <div className="contact-info">
        <div className="contact-name">{firstName} {lastName}</div>
        <div className="contact-phone">{formatPhoneNumberWithCode(phoneCodeList, phoneNumber)}</div>
      </div>
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, { contact }): StateProps => {
    const { countryList: { phoneCodes: phoneCodeList } } = global;
    return {
      user: selectUser(global, contact.userId),
      phoneCodeList,
    };
  },
)(Contact);
