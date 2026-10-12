import type { TeactNode } from '../../lib/teact/teact';
import {
  memo,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import useLang from '../../hooks/useLang';

import styles from './ChatGroupedLastMessage.module.scss';

export type GroupedLastMessageItem = {
  key: string | number;
  title: string;
  isUnread?: boolean;
  icon?: TeactNode;
};

type OwnProps = {
  // `undefined` while the items are still loading
  items?: GroupedLastMessageItem[];
  hasTags?: boolean;
  renderLastMessage: () => TeactNode | undefined;
  // Returns `true` when the click is handled, so it does not open the chat itself
  onMainItemClick?: () => boolean;
};

const NO_CORNER_THRESHOLD = Number(REM);
const ICON_CLASS_NAME = buildClassName(styles.icon, 'in-text-icon');

// A chat list subtitle that groups a chat's parts (forum topics, community chats)
// on one row and previews the freshest one's last message below, connecting
// both with a bubble when that part is unread
const ChatGroupedLastMessage = ({
  items,
  hasTags,
  renderLastMessage,
  onMainItemClick,
}: OwnProps) => {
  const lastMessageRef = useRef<HTMLDivElement>();
  const mainColumnRef = useRef<HTMLDivElement>();

  const [mainItem, ...otherItems] = items || [];

  const lang = useLang();

  const [isReversedCorner, setIsReversedCorner] = useState(false);
  const [overwrittenWidth, setOverwrittenWidth] = useState<number | undefined>(undefined);

  const {
    handleClick: handleMainItemClick,
    handleMouseDown: handleMainItemMouseDown,
  } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMainItemClick?.()) return;

    e.stopPropagation();
    e.preventDefault();
  });

  useEffect(() => {
    if (hasTags) return undefined;

    let isCancelled = false;

    requestMeasure(() => {
      const lastMessageElement = lastMessageRef.current;
      const mainColumnElement = mainColumnRef.current;
      if (isCancelled || !lastMessageElement || !mainColumnElement) return;

      const lastMessageWidth = lastMessageElement.offsetWidth;
      const mainColumnWidth = mainColumnElement.offsetWidth;

      requestMutation(() => {
        if (isCancelled) return;

        setOverwrittenWidth(Math.abs(lastMessageWidth - mainColumnWidth) < NO_CORNER_THRESHOLD
          ? Math.max(lastMessageWidth, mainColumnWidth) : undefined);
        setIsReversedCorner(lastMessageWidth > mainColumnWidth);
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [mainItem, renderLastMessage, hasTags]);

  return (
    <div
      className={buildClassName(
        styles.root,
        isReversedCorner && styles.reverseCorner,
        overwrittenWidth && styles.overwrittenWidth,
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      style={overwrittenWidth ? `--overwritten-width: ${overwrittenWidth}px` : undefined}
    >
      {
        !hasTags && (
          <>
            {mainItem && (
              <div className={styles.titleRow}>
                <div
                  className={buildClassName(
                    styles.mainColumn,
                    mainItem.isUnread && styles.unread,
                  )}
                  ref={mainColumnRef}
                  onClick={handleMainItemClick}
                  onMouseDown={handleMainItemMouseDown}
                >
                  {Boolean(mainItem.icon) && <span className={ICON_CLASS_NAME}>{mainItem.icon}</span>}
                  <div className={styles.title}>{renderText(mainItem.title)}</div>
                  {!overwrittenWidth && isReversedCorner && (
                    <div className={styles.afterWrapper}>
                      <div className={styles.after} />
                    </div>
                  )}
                </div>

                <div className={styles.otherColumns}>
                  {otherItems.map((item) => (
                    <div
                      className={buildClassName(
                        styles.otherColumn, item.isUnread && styles.unread,
                      )}
                      key={item.key}
                    >
                      {Boolean(item.icon) && <span className={ICON_CLASS_NAME}>{item.icon}</span>}
                      <span className={styles.otherColumnTitle}>{renderText(item.title)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.ellipsis} />
              </div>
            )}
            {!items && (
              <div className={buildClassName(styles.titleRow, styles.loading)}>
                {lang('Loading')}
              </div>
            )}
          </>
        )
      }
      <div
        className={buildClassName(
          styles.lastMessage,
          mainItem?.isUnread && !hasTags && styles.unread,
        )}
        ref={lastMessageRef}
        onClick={handleMainItemClick}
        onMouseDown={handleMainItemMouseDown}
      >
        {renderLastMessage()}
        {!overwrittenWidth && !isReversedCorner && (
          <div className={styles.afterWrapper}>
            <div className={styles.after} />
          </div>
        )}
      </div>

    </div>
  );
};

export default memo(ChatGroupedLastMessage);
