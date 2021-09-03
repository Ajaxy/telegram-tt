import React, { FC, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiUser, ApiContact, ApiCountryCode } from '../../../api/types';

import { selectUser } from '../../../modules/selectors';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';

import Avatar from '../../common/Avatar';

import './Contact.scss';
import { pick } from '../../../util/iteratees';
import buildClassName from '../../../util/buildClassName';

type OwnProps = {
  contact: ApiContact;
};

type StateProps = {
  user?: ApiUser;
  phoneCodeList: ApiCountryCode[];
};

type DispatchProps = Pick<GlobalActions, 'openUserInfo'>;

const Contact: FC<OwnProps & StateProps & DispatchProps> = ({
  contact, user, openUserInfo, phoneCodeList,
}) => {
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openUserInfo',
  ]),
)(Contact);
