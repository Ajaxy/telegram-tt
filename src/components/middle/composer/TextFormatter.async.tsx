import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './TextFormatter';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const TextFormatterAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const TextFormatter = useModuleLoader(Bundles.Extra, 'TextFormatter', !isOpen);

  return TextFormatter ? <TextFormatter {...props} /> : undefined;
};

export default TextFormatterAsync;
