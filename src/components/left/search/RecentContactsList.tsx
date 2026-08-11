import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Island from '../../gili/layout/Island';
import Button from '../../ui/Button';
import LeftSearchResultChat from './LeftSearchResultChat';

type OwnProps = {
  chatIds: string[];
  noTopBorder?: boolean;
  onChatClick: (id: string) => void;
  onClear: NoneToVoidFunction;
};

const RecentContactsList = ({
  chatIds,
  noTopBorder,
  onChatClick,
  onClear,
}: OwnProps) => {
  const lang = useLang();

  return (
    <Island className="search-island search-section pt-1">
      <h3
        className={buildClassName(
          'section-heading mt-0 recent-chats-header',
          noTopBorder && 'without-border',
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {lang('Recent')}

        <Button
          className="clear-recent-chats"
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('Clear')}
          onClick={onClear}
          isRtl={lang.isRtl}
          iconName="close"
        />
      </h3>
      {chatIds.map((id) => (
        <LeftSearchResultChat
          key={id}
          chatId={id}
          withOpenAppButton
          onClick={onChatClick}
        />
      ))}
    </Island>
  );
};

export default memo(RecentContactsList);
