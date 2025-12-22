import type { OwnProps } from './TextFormatter';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const TextFormatterAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const TextFormatter = useModuleLoader(Bundles.Extra, 'TextFormatter', !isOpen);

  return TextFormatter ? <TextFormatter {...props} /> : undefined;
};

export default TextFormatterAsync;
