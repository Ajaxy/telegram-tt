import React, {
  FC, memo, useCallback, useState,
} from '../../../lib/teact/teact';

import { LeftColumnContent } from '../../../types';

import { LAYERS_ANIMATION_NAME } from '../../../util/environment';

import Transition from '../../ui/Transition';
import NewChatStep1 from './NewChatStep1';
import NewChatStep2 from './NewChatStep2';

import './NewChat.scss';

export type OwnProps = {
  isChannel?: boolean;
  content: LeftColumnContent;
  onContentChange: (content: LeftColumnContent) => void;
  onReset: () => void;
};

const RENDER_COUNT = Object.keys(LeftColumnContent).length / 2;

const NewChat: FC<OwnProps> = ({
  isChannel = false,
  content,
  onContentChange,
  onReset,
}) => {
  const [newChatMemberIds, setNewChatMemberIds] = useState<number[]>([]);

  const handleNextStep = useCallback(() => {
    onContentChange(isChannel ? LeftColumnContent.NewChannelStep2 : LeftColumnContent.NewGroupStep2);
  }, [isChannel, onContentChange]);

  return (
    <Transition
      id="NewChat"
      name={LAYERS_ANIMATION_NAME}
      renderCount={RENDER_COUNT}
      activeKey={content}
    >
      {() => {
        switch (content) {
          case LeftColumnContent.NewChannelStep1:
          case LeftColumnContent.NewGroupStep1:
            return (
              <NewChatStep1
                isChannel={isChannel}
                selectedMemberIds={newChatMemberIds}
                onSelectedMemberIdsChange={setNewChatMemberIds}
                onNextStep={handleNextStep}
                onReset={onReset}
              />
            );
          case LeftColumnContent.NewChannelStep2:
          case LeftColumnContent.NewGroupStep2:
            return (
              <NewChatStep2
                isChannel={isChannel}
                memberIds={newChatMemberIds}
                onReset={onReset}
              />
            );
          default:
            return undefined;
        }
      }}
    </Transition>
  );
};

export default memo(NewChat);
