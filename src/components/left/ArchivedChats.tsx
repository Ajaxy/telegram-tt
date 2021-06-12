import React, { FC, memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import ChatList from './main/ChatList';

import './ArchivedChats.scss';

export type OwnProps = {
  isActive: boolean;
  onReset: () => void;
};

const ArchivedChats: FC<OwnProps> = ({ isActive, onReset }) => {
  const lang = useLang();

  return (
    <div className="ArchivedChats">
      <div className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={onReset}
          ariaLabel="Return to chat list"
        >
          <i className="icon-arrow-left" />
        </Button>
        <h3>{lang('ArchivedChats')}</h3>
      </div>
      <ChatList folderType="archived" noChatsText="Archive is empty." isActive={isActive} />
    </div>
  );
};

export default memo(ArchivedChats);
