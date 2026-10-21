import { memo, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ThreadId } from '../../../types';

import { selectChatMessages } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatEditDelay, getUnseenLateEdits, markEditRadarSeen } from '../../../util/editRadar';
import { getServerTime } from '../../../util/serverTime';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './EditRadarPane.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  messagesById?: Record<number, ApiMessage>;
};

const EditRadarPane = ({
  chatId,
  threadId,
  messagesById,
  onPaneStateChange,
}: OwnProps & StateProps) => {
  const { focusMessage } = getActions();
  const lang = useLang();

  // Seen edits live in local storage, so bump a counter to re-check them after the user acts
  const [seenVersion, setSeenVersion] = useState(0);

  const lateEdits = useMemo(() => {
    return getUnseenLateEdits(chatId, messagesById, getServerTime());
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [chatId, messagesById, seenVersion]);

  const isOpen = lateEdits.length > 0;
  const { lateEdits: renderingLateEdits } = useFrozenProps({ lateEdits }, !isOpen);

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    measureKey: chatId,
    withResizeObserver: true,
    onStateChange: onPaneStateChange,
  });

  const handleShow = useLastCallback(() => {
    const [latest] = lateEdits;
    if (!latest) return;

    focusMessage({ chatId, threadId, messageId: latest.id });
    markEditRadarSeen(chatId, [latest]);
    setSeenVersion((version) => version + 1);
  });

  const handleDismiss = useLastCallback(() => {
    markEditRadarSeen(chatId, lateEdits);
    setSeenVersion((version) => version + 1);
  });

  if (!shouldRender || !renderingLateEdits.length) return undefined;

  const [latest] = renderingLateEdits;
  const count = renderingLateEdits.length;
  const title = count === 1
    ? lang('EditRadarPaneTitle', { delay: formatEditDelay(lang, latest.editDate! - latest.date) })
    : lang('EditRadarPaneTitleMany', { count }, { pluralValue: count });

  return (
    <div
      ref={ref}
      className={buildClassName('EditRadarPane', styles.root)}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <span className={styles.radar} aria-hidden>
        <Icon name="clock-edit" />
      </span>
      <button type="button" className={styles.text} onClick={handleShow}>
        {title}
      </button>
      <Button
        isText
        noForcedUpperCase
        pill
        size="tiny"
        className={styles.show}
        onClick={handleShow}
      >
        {lang('EditRadarPaneShow')}
      </Button>
      <Button
        round
        size="smaller"
        color="translucent"
        onClick={handleDismiss}
        ariaLabel={lang('EditRadarPaneDismiss')}
        iconName="close"
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    return {
      messagesById: selectChatMessages(global, chatId),
    };
  },
)(EditRadarPane));
