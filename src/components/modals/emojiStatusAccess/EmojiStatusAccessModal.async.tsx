import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './EmojiStatusAccessModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const EmojiStatusAccessModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const EmojiStatusAccessModal = useModuleLoader(Bundles.Extra, 'EmojiStatusAccessModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return EmojiStatusAccessModal ? <EmojiStatusAccessModal {...props} /> : undefined;
};

export default EmojiStatusAccessModalAsync;
