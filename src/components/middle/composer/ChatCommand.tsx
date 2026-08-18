import { memo } from '../../../lib/teact/teact';

import type { ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';

import './ChatCommand.scss';

type OwnProps<T = undefined> = {
  command: string;
  description: string;
  peer?: ApiUser;
  withAvatar?: boolean;
  focus?: boolean;
  isEphemeral?: true;
  clickArg: T;
  onClick: (arg: T) => void;
};

const ChatCommand = <T,>({
  withAvatar,
  focus,
  command,
  description,
  peer,
  isEphemeral,
  clickArg,
  onClick,
}: OwnProps<T>) => {
  const lang = useLang();

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
        <span className="title">
          /
          {command}
          {isEphemeral && (
            <Icon name="eye" className="ephemeral-icon in-text-icon" ariaLabel={lang('EphemeralOnlyVisible')} />
          )}
        </span>
        <span className="subtitle">{renderText(description)}</span>
      </div>
    </ListItem>
  );
};

export default memo(ChatCommand);
