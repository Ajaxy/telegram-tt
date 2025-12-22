import type { OwnProps } from './ProfileRatingModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ProfileRatingModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ProfileRatingModal = useModuleLoader(Bundles.Extra, 'ProfileRatingModal', !modal);

  return ProfileRatingModal ? <ProfileRatingModal {...props} /> : undefined;
};

export default ProfileRatingModalAsync;
