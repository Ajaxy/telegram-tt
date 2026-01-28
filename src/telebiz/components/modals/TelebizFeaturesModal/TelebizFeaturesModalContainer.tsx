import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizFeatureSection } from '../../../global/types';

import { selectTabState } from '../../../../global/selectors';
import TelebizFeaturesModal from './index';

type StateProps = {
  isOpen: boolean;
  section?: TelebizFeatureSection;
};

const TelebizFeaturesModalContainer = ({
  isOpen,
  section,
}: StateProps) => {
  const { telebizCloseFeaturesModal } = getActions();

  return (
    <TelebizFeaturesModal
      isOpen={isOpen}
      initialSection={section}
      onClose={telebizCloseFeaturesModal}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const featuresModal = tabState.featuresModal;

    return {
      isOpen: featuresModal?.isOpen || false,
      section: featuresModal?.section,
    };
  },
)(TelebizFeaturesModalContainer));
