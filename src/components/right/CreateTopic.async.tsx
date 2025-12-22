import type { OwnProps } from './CreateTopic';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const CreateTopicAsync = (props: OwnProps) => {
  const CreateTopic = useModuleLoader(Bundles.Extra, 'CreateTopic');

  return CreateTopic ? <CreateTopic {...props} /> : <Loading />;
};

export default CreateTopicAsync;
