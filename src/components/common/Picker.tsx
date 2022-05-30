import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, useRef, useEffect, memo,
} from '../../lib/teact/teact';

import { isUserId } from '../../global/helpers';

import InfiniteScroll from '../ui/InfiniteScroll';
import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import PrivateChatInfo from './PrivateChatInfo';
import GroupChatInfo from './GroupChatInfo';
import PickerSelectedItem from './PickerSelectedItem';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';

import Loading from '../ui/Loading';

import './Picker.scss';

type OwnProps = {
  itemIds: string[];
  selectedIds: string[];
  filterValue?: string;
  filterPlaceholder?: string;
  notFoundText?: string;
  searchInputId?: string;
  isLoading?: boolean;
  noScrollRestore?: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onFilterChange: (value: string) => void;
  onLoadMore?: () => void;
};

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;

const MAX_FULL_ITEMS = 10;
const ALWAYS_FULL_ITEMS_COUNT = 5;

const Picker: FC<OwnProps> = ({
  itemIds,
  selectedIds,
  filterValue,
  filterPlaceholder,
  notFoundText,
  searchInputId,
  isLoading,
  noScrollRestore,
  onSelectedIdsChange,
  onFilterChange,
  onLoadMore,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldMinimize = selectedIds.length > MAX_FULL_ITEMS;

  useEffect(() => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        inputRef.current!.focus();
      });
    }, FOCUS_DELAY_MS);
  }, []);

  const handleItemClick = useCallback((id: string) => {
    const newSelectedIds = [...selectedIds];
    if (newSelectedIds.includes(id)) {
      newSelectedIds.splice(newSelectedIds.indexOf(id), 1);
    } else {
      newSelectedIds.push(id);
    }
    onSelectedIdsChange(newSelectedIds);
    onFilterChange('');
  }, [selectedIds, onSelectedIdsChange, onFilterChange]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange(value);
  }, [onFilterChange]);

  const [viewportIds, getMore] = useInfiniteScroll(onLoadMore, itemIds, Boolean(filterValue));

  const lang = useLang();

  return (
    <div className="Picker">
      <div className="picker-header custom-scroll" dir={lang.isRtl ? 'rtl' : undefined}>
        {selectedIds.map((id, i) => (
          <PickerSelectedItem
            chatOrUserId={id}
            isMinimized={shouldMinimize && i < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT}
            canClose
            onClick={handleItemClick}
            clickArg={id}
          />
        ))}
        <InputText
          id={searchInputId}
          ref={inputRef}
          value={filterValue}
          onChange={handleFilterChange}
          placeholder={filterPlaceholder || lang('SelectChat')}
        />
      </div>

      {viewportIds?.length ? (
        <InfiniteScroll
          className="picker-list custom-scroll"
          items={viewportIds}
          onLoadMore={getMore}
          noScrollRestore={noScrollRestore}
        >
          {viewportIds.map((id) => (
            <ListItem
              key={id}
              className="chat-item-clickable picker-list-item"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleItemClick(id)}
              ripple
            >
              <Checkbox label="" checked={selectedIds.includes(id)} />
              {isUserId(id) ? (
                <PrivateChatInfo userId={id} />
              ) : (
                <GroupChatInfo chatId={id} />
              )}
            </ListItem>
          ))}
        </InfiniteScroll>
      ) : !isLoading && viewportIds && !viewportIds.length ? (
        <p className="no-results">{notFoundText || 'Sorry, nothing found.'}</p>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(Picker);
