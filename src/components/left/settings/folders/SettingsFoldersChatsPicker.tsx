import React, {
  FC, useCallback, useRef, useEffect, memo,
} from '../../../../lib/teact/teact';

import { isUserId } from '../../../../global/helpers';
import {
  INCLUDED_CHAT_TYPES,
  EXCLUDED_CHAT_TYPES,
  FolderChatType,
} from '../../../../hooks/reducers/useFoldersReducer';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import useLang from '../../../../hooks/useLang';

import Checkbox from '../../../ui/Checkbox';
import InputText from '../../../ui/InputText';
import ListItem from '../../../ui/ListItem';
import PrivateChatInfo from '../../../common/PrivateChatInfo';
import GroupChatInfo from '../../../common/GroupChatInfo';
import PickerSelectedItem from '../../../common/PickerSelectedItem';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import Loading from '../../../ui/Loading';

import '../../../common/Picker.scss';
import './SettingsFoldersChatsPicker.scss';

type OwnProps = {
  mode: 'included' | 'excluded';
  chatIds: string[];
  selectedIds: string[];
  selectedChatTypes: string[];
  filterValue?: string;
  onSelectedIdsChange: (ids: string[]) => void;
  onSelectedChatTypesChange: (types: string[]) => void;
  onFilterChange: (value: string) => void;
};

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;

const MAX_CHATS = 100;
const MAX_FULL_ITEMS = 10;
const ALWAYS_FULL_ITEMS_COUNT = 5;

const SettingsFoldersChatsPicker: FC<OwnProps> = ({
  mode,
  chatIds,
  selectedIds,
  selectedChatTypes,
  filterValue,
  onSelectedIdsChange,
  onSelectedChatTypesChange,
  onFilterChange,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const chatTypes = mode === 'included' ? INCLUDED_CHAT_TYPES : EXCLUDED_CHAT_TYPES;
  const shouldMinimize = selectedIds.length + selectedChatTypes.length > MAX_FULL_ITEMS;
  const hasMaxChats = selectedIds.length >= MAX_CHATS;

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
  }, [selectedIds, onSelectedIdsChange]);

  const handleChatTypeClick = useCallback((key: FolderChatType['key']) => {
    const newSelectedChatTypes = [...selectedChatTypes];
    if (newSelectedChatTypes.includes(key)) {
      newSelectedChatTypes.splice(newSelectedChatTypes.indexOf(key), 1);
    } else {
      newSelectedChatTypes.push(key);
    }
    onSelectedChatTypesChange(newSelectedChatTypes);
  }, [selectedChatTypes, onSelectedChatTypesChange]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange(value);
  }, [onFilterChange]);

  const lang = useLang();

  function renderSelectedChatType(key: string) {
    const selectedType = chatTypes.find(({ key: typeKey }) => key === typeKey);
    if (!selectedType) {
      return undefined;
    }

    return (
      <PickerSelectedItem
        icon={selectedType.icon}
        title={lang(selectedType.title)}
        isMinimized={shouldMinimize}
        canClose
        onClick={handleChatTypeClick}
        clickArg={selectedType.key}
      />
    );
  }

  function renderChatType(type: FolderChatType) {
    return (
      <ListItem
        key={type.key}
        className="chat-item-clickable picker-list-item chat-type-item"
        onClick={() => handleChatTypeClick(type.key)}
        ripple
      >
        <i className={`icon-${type.icon}`} />
        <h3 className="chat-type" dir="auto">{lang(type.title)}</h3>
        <Checkbox
          label=""
          checked={selectedChatTypes.includes(type.key)}
          round
        />
      </ListItem>
    );
  }

  function renderItem(id: string) {
    const isSelected = selectedIds.includes(id);

    return (
      <ListItem
        key={id}
        className="chat-item-clickable picker-list-item chat-item"
        onClick={() => handleItemClick(id)}
        ripple
        disabled={!isSelected && hasMaxChats}
      >
        {isUserId(id) ? (
          <PrivateChatInfo userId={id} />
        ) : (
          <GroupChatInfo chatId={id} withChatType />
        )}
        <Checkbox
          label=""
          checked={isSelected}
          round
        />
      </ListItem>
    );
  }

  const [viewportIds, getMore] = useInfiniteScroll(undefined, chatIds, Boolean(filterValue));

  return (
    <div className="Picker SettingsFoldersChatsPicker">
      <div className="picker-header custom-scroll">
        {selectedChatTypes.map(renderSelectedChatType)}
        {selectedIds.map((id, i) => (
          <PickerSelectedItem
            chatOrUserId={id}
            isMinimized={shouldMinimize && i < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT}
            canClose
            onClick={handleItemClick}
            clickArg={id}
          />
        ))}
        {!hasMaxChats ? (
          <InputText
            ref={inputRef}
            value={filterValue}
            onChange={handleFilterChange}
            placeholder={lang('Search')}
          />
        ) : (
          <p className="max-items-reached" dir="auto">
            {`Sorry, you can't add more than ${MAX_CHATS} chats.`}
          </p>
        )}
      </div>
      <InfiniteScroll
        className="picker-list custom-scroll"
        itemSelector=".chat-item"
        items={viewportIds}
        onLoadMore={getMore}
      >
        {(!viewportIds || !viewportIds.length || viewportIds.includes(chatIds[0])) && (
          <>
            <h4 key="header1" className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('FilterChatTypes')}
            </h4>
            {chatTypes.map(renderChatType)}
            <div key="divider" className="picker-list-divider" />
            <h4 key="header2" className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('FilterChats')}
            </h4>
          </>
        )}

        {viewportIds?.length ? (
          viewportIds.map(renderItem)
        ) : viewportIds && !viewportIds.length ? (
          <p className="no-results" key="no-results">Sorry, nothing found.</p>
        ) : (
          <Loading key="loading" />
        )}
      </InfiniteScroll>
    </div>
  );
};

export default memo(SettingsFoldersChatsPicker);
