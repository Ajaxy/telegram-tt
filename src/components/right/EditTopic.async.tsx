import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './EditTopic';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const EditTopicAsync: FC<OwnProps> = (props) => {
  const EditTopic = useModuleLoader(Bundles.Extra, 'EditTopic');

  return EditTopic ? <EditTopic {...props} /> : <Loading />;
};

export default EditTopicAsync;
