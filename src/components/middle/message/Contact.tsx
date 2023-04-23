import type { FC } from '../../../lib/teact/teact';
import React, { useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiUser, ApiContact, ApiCountryCode, ApiPhoto,
} from '../../../api/types';
import type { AnimationLevel } from '../../../types';

import { selectUser, selectUserPhotoFromFullInfo } from '../../../global/selectors';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import buildClassName from '../../../util/buildClassName';

import Avatar from '../../common/Avatar';

import './Contact.scss';

type OwnProps = {
  contact: ApiContact;
};

type StateProps = {
  user?: ApiUser;
  userProfilePhoto?: ApiPhoto;
  phoneCodeList: ApiCountryCode[];
  animationLevel: AnimationLevel;
};

const UNREGISTERED_CONTACT_ID = '0';

const Contact: FC<OwnProps & StateProps> = ({
  contact, user, userProfilePhoto, phoneCodeList, animationLevel,
}) => {
  const { openChat } = getActions();

  const {
    firstName,
    lastName,
    phoneNumber,
    userId,
  } = contact;
  const isRegistered = userId !== UNREGISTERED_CONTACT_ID;

  const handleClick = useCallback(() => {
    openChat({ id: userId });
  }, [openChat, userId]);

  return (
    <div
      className={buildClassName('Contact', isRegistered && 'interactive')}
      onClick={isRegistered ? handleClick : undefined}
    >
      <Avatar
        size="large"
        user={user}
        userProfilePhoto={userProfilePhoto}
        text={firstName || lastName}
        animationLevel={animationLevel}
        withVideo
      />
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
    const user = selectUser(global, contact.userId);
    const userProfilePhoto = user ? selectUserPhotoFromFullInfo(global, user.id) : undefined;

    return {
      user,
      userProfilePhoto,
      phoneCodeList,
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(Contact);
