import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  chatId?: string;
  children: any;
};

type DispatchProps = Pick<GlobalActions, 'openChat'>;

const ChatLink: FC<OwnProps & DispatchProps> = ({
  className, chatId, openChat, children,
}) => {
  const handleClick = useCallback(() => {
    if (chatId) {
      openChat({ id: chatId });
    }
  }, [chatId, openChat]);

  if (!chatId) {
    return children;
  }

  return (
    <Link className={buildClassName('ChatLink', className)} onClick={handleClick}>{children}</Link>
  );
};

export default withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['openChat']),
)(ChatLink);
