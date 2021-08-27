import React, {
  FC, useEffect, useCallback, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiUser } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import { throttle } from '../../../util/schedulers';
import searchWords from '../../../util/searchWords';
import { pick } from '../../../util/iteratees';
import { getUserFullName, sortUserIds } from '../../../modules/helpers';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';

export type OwnProps = {
  filter: string;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  contactIds?: number[];
  serverTimeOffset: number;
};

type DispatchProps = Pick<GlobalActions, 'loadContactList' | 'openChat'>;

const runThrottled = throttle((cb) => cb(), 60000, true);

const ContactList: FC<OwnProps & StateProps & DispatchProps> = ({
  isActive, onReset,
  filter, usersById, contactIds, loadContactList, openChat, serverTimeOffset,
}) => {
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadContactList();
    });
  });

  useHistoryBack(isActive, onReset);

  const handleClick = useCallback(
    (id: number) => {
      openChat({ id, shouldReplaceHistory: true });
    },
    [openChat],
  );

  const listIds = useMemo(() => {
    if (!contactIds) {
      return undefined;
    }

    const resultIds = filter ? contactIds.filter((id) => {
      const user = usersById[id];
      if (!user) {
        return false;
      }
      const fullName = getUserFullName(user);
      return fullName && searchWords(fullName, filter);
    }) : contactIds;

    return sortUserIds(resultIds, usersById, undefined, serverTimeOffset);
  }, [contactIds, filter, usersById, serverTimeOffset]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, listIds, Boolean(filter));

  return (
    <InfiniteScroll items={viewportIds} onLoadMore={getMore} className="chat-list custom-scroll">
      {viewportIds?.length ? (
        viewportIds.map((id) => (
          <ListItem
            key={id}
            className="chat-item-clickable"
            onClick={() => handleClick(id)}
            ripple={!IS_SINGLE_COLUMN_LAYOUT}
          >
            <PrivateChatInfo userId={id} forceShowSelf avatarSize="large" />
          </ListItem>
        ))
      ) : viewportIds && !viewportIds.length ? (
        <p className="no-results" key="no-results" dir="auto">
          {filter.length ? 'No contacts matched your search.' : 'Contact list is empty.'}
        </p>
      ) : (
        <Loading key="loading" />
      )}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { userIds: contactIds } = global.contactList || {};
    const { byId: usersById } = global.users;

    return {
      usersById,
      contactIds,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadContactList', 'openChat']),
)(ContactList));
