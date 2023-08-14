import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type {
  ApiMessage, ApiTypeStory,
} from '../../../api/types';

import { selectUserStory } from '../../../global/selectors';

import BaseStory from './BaseStory';

interface OwnProps {
  message: ApiMessage;
  isProtected?: boolean;
}

interface StateProps {
  story?: ApiTypeStory;
  isConnected?: boolean;
}

function Story({
  message, story, isProtected, isConnected,
}: OwnProps & StateProps) {
  const { storyData } = message.content;

  return (
    <BaseStory
      story={story || storyData}
      isProtected={isProtected}
      isConnected={isConnected}
    />
  );
}

export default memo(withGlobal<OwnProps>((global, { message }): StateProps => {
  const { id, userId } = message.content.storyData!;

  return {
    story: selectUserStory(global, userId, id),
    isConnected: global.connectionState === 'connectionStateReady',
  };
})(Story));
