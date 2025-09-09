import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './ProfileRatingModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ProfileRatingModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const ProfileRatingModal = useModuleLoader(Bundles.Extra, 'ProfileRatingModal', !modal);

  return ProfileRatingModal ? <ProfileRatingModal {...props} /> : undefined;
};

export default ProfileRatingModalAsync;
