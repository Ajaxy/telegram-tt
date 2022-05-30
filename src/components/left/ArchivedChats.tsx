import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import Button from '../ui/Button';
import ChatList from './main/ChatList';
import type { LeftColumnContent } from '../../types';

import './ArchivedChats.scss';

export type OwnProps = {
  isActive: boolean;
  onReset: () => void;
  onContentChange: (content: LeftColumnContent) => void;
};

const ArchivedChats: FC<OwnProps> = ({ isActive, onReset }) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

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
      <ChatList folderType="archived" isActive={isActive} />
    </div>
  );
};

export default memo(ArchivedChats);
