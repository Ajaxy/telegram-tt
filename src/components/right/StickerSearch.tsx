import React, {
  FC, memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';
import { throttle } from '../../util/schedulers';
import { selectCurrentStickerSearch } from '../../modules/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import Loading from '../ui/Loading';
import StickerSetResult from './StickerSetResult';

import './StickerSearch.scss';

type OwnProps = {
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  query?: string;
  featuredIds?: string[];
  resultIds?: string[];
};

type DispatchProps = Pick<GlobalActions, 'loadFeaturedStickers'>;

const INTERSECTION_THROTTLE = 200;

const runThrottled = throttle((cb) => cb(), 60000, true);

const StickerSearch: FC<OwnProps & StateProps & DispatchProps> = ({
  onClose,
  isActive,
  query,
  featuredIds,
  resultIds,
  loadFeaturedStickers,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadFeaturedStickers();
    });
  });

  useHistoryBack(isActive, onClose);

  function renderContent() {
    if (query === undefined) {
      return undefined;
    }

    if (!query && featuredIds) {
      return featuredIds.map((id) => (
        <StickerSetResult
          key={id}
          stickerSetId={id}
          observeIntersection={observeIntersection}
          isSomeModalOpen={isModalOpen}
          onModalToggle={setIsModalOpen}
        />
      ));
    }

    if (resultIds) {
      if (!resultIds.length) {
        return <p className="helper-text" dir="auto">Nothing found.</p>;
      }

      return resultIds.map((id) => (
        <StickerSetResult
          key={id}
          stickerSetId={id}
          observeIntersection={observeIntersection}
          isSomeModalOpen={isModalOpen}
          onModalToggle={setIsModalOpen}
        />
      ));
    }

    return <Loading />;
  }

  return (
    <div ref={containerRef} className="StickerSearch custom-scroll" dir={lang.isRtl ? 'rtl' : undefined}>
      {renderContent()}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const currentSearch = selectCurrentStickerSearch(global);
    const { query, resultIds } = currentSearch || {};
    const { featured } = global.stickers;

    return {
      query,
      featuredIds: featured.setIds,
      resultIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadFeaturedStickers']),
)(StickerSearch));
