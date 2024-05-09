import React, { memo } from '../../../lib/teact/teact';

import type { ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import ListItem from '../../ui/ListItem';

import './ChatCommand.scss';

type OwnProps<T = undefined> = {
  command: string;
  description: string;
  peer?: ApiUser;
  withAvatar?: boolean;
  focus?: boolean;
  clickArg: T;
  onClick: (arg: T) => void;
};

// eslint-disable-next-line @typescript-eslint/comma-dangle
const ChatCommand = <T,>({
  withAvatar,
  focus,
  command,
  description,
  peer,
  clickArg,
  onClick,
}: OwnProps<T>) => {
  const handleClick = useLastCallback(() => {
    onClick(clickArg);
  });

  return (
    <ListItem
      key={command}
      className={buildClassName('BotCommand chat-item-clickable scroll-item', withAvatar && 'with-avatar')}
      multiline
      onClick={handleClick}
      focus={focus}
    >
      {withAvatar && (
        <Avatar size="small" peer={peer} />
      )}
      <div className="content-inner">
        <span className="title">/{command}</span>
        <span className="subtitle">{renderText(description)}</span>
      </div>
    </ListItem>
  );
};

export default memo(ChatCommand);
