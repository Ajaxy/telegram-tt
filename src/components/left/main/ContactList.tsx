import React, {
  FC, useEffect, useCallback, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiUser } from '../../../api/types';

import { IS_MOBILE_SCREEN } from '../../../util/environment';
import { throttle } from '../../../util/schedulers';
import searchWords from '../../../util/searchWords';
import { pick } from '../../../util/iteratees';
import { getUserFullName, sortUserIds } from '../../../modules/helpers';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';

export type OwnProps = {
  filter: string;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  contactIds?: number[];
  serverTimeOffset: number;
};

type DispatchProps = Pick<GlobalActions, 'loadContactList' | 'openChat'>;

const runThrottled = throttle((cb) => cb(), 60000, true);

const ContactList: FC<OwnProps & StateProps & DispatchProps> = ({
  filter, usersById, contactIds, loadContactList, openChat, serverTimeOffset,
}) => {
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadContactList();
    });
  });

  const handleClick = useCallback(
    (id: number) => {
      openChat({ id });
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
      {viewportIds && viewportIds.length ? (
        viewportIds.map((id) => (
          <ListItem
            key={id}
            className="chat-item-clickable"
            onClick={() => handleClick(id)}
            ripple={!IS_MOBILE_SCREEN}
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
