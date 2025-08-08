import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './SuggestMessageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const SuggestMessageModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const SuggestMessageModal = useModuleLoader(Bundles.Extra, 'SuggestMessageModal', !modal);

  return SuggestMessageModal ? <SuggestMessageModal {...props} /> : <Loading />;
};

export default SuggestMessageModalAsync;
