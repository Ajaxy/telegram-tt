import {
  memo, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../../global';

import type { ApiBotInlineMediaResult, ApiBotInlineResult } from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import type { WidgetHost } from '../../../../lib/widget-sandbox';
import type { ThemeKey } from '../../../../types';

import { forceMutation, requestForcedReflow, requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface, selectTheme } from '../../../../global/selectors';
import { selectSharedSettings } from '../../../../global/selectors/sharedState';
import buildClassName from '../../../../util/buildClassName';
import loadWidgetSandbox from '../../../../util/loadWidgetSandbox';
import { REM } from '../../../common/helpers/mediaDimensions';
import { preventMessageInputBlurWithBubbling } from '../../helpers/preventMessageInputBlur';

import { useIsIntersecting } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import ListItem from '../../../ui/ListItem';
import {
  buildWidgetTheme, FEATURES, IS_SUPPORTED, MAX_HEIGHT, MIN_HEIGHT, MIN_WIDTH, PLACEHOLDER_HEIGHT,
} from '../../message/Widget';
import ArticleResult from './ArticleResult';

import styles from './WidgetResult.module.scss';

type OwnProps = {
  focus?: boolean;
  inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult;
  observeIntersection?: ObserveFn;
  onClick: (result: ApiBotInlineResult | ApiBotInlineMediaResult) => void;
};

type StateProps = {
  theme: ThemeKey;
  areWidgetsDisabled?: boolean;
  messageTextSize: number;
};

function clampHeight(height: number) {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
}

const WidgetResult = ({
  focus, inlineResult, observeIntersection, theme, messageTextSize, areWidgetsDisabled, onClick,
}: OwnProps & StateProps) => {
  const lang = useLang();
  const widget = inlineResult.sendMessage.content.widget!;
  const {
    html, width, height, chatData, publicData,
  } = widget;
  const rootRef = useRef<HTMLDivElement>();
  const mountRef = useRef<HTMLDivElement>();
  const hostRef = useRef<WidgetHost>();
  // The last run of a row that left the screen: its worker is gone, its render stays as a picture until a new run loads
  const pictureRef = useRef<WidgetHost>();
  const [naturalHeight, setNaturalHeight] = useState(PLACEHOLDER_HEIGHT);
  const [hasFailed, setHasFailed] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden);
  const canRender = IS_SUPPORTED && !areWidgetsDisabled && Boolean(html);
  // The text fallback has no root to observe
  const isIntersecting = useIsIntersecting(rootRef, canRender && !hasFailed ? observeIntersection : undefined);
  const isVisible = isIntersecting && isDocumentVisible;

  const handleClick = useLastCallback(() => {
    onClick(inlineResult);
  });

  const createHost = useLastCallback((
    Runtime: typeof WidgetHost, getIsCancelled: () => boolean, onLoaded: NoneToVoidFunction,
  ) => {
    const root = rootRef.current!;
    const widgetTheme = buildWidgetTheme(root, theme);
    // The renderer measures its still empty document until the sandbox has booted, as in a message
    let isLoaded = false;
    let pendingHeight: number | undefined;
    let host: WidgetHost;
    // The library appends its shadow host and synchronously measures the initial viewport
    forceMutation(() => {
      // A preview takes no input, asks nothing and keeps no storage (widget-sandbox sdk-v1 §2.16)
      host = new Runtime(mountRef.current!, html!, {
        theme: widgetTheme,
        locale: lang.code,
        features: FEATURES,
        data: { chatData: chatData || undefined, publicData: publicData || undefined },
        context: { preview: true },
        reducedMotion: !selectCanAnimateInterface(getGlobal()),
        // A preview follows the visibility rules of any bubble (widget-sandbox sdk-v1 §2.16)
        visible: isVisible,
        stoppedLabel: lang('WidgetStopped'),
        onResize: (newHeight) => {
          if (getIsCancelled()) return;
          if (isLoaded) setNaturalHeight(clampHeight(newHeight));
          else pendingHeight = newHeight;
        },
        onLoaded: () => {
          isLoaded = true;
          if (getIsCancelled()) return;
          if (pendingHeight !== undefined) setNaturalHeight(clampHeight(pendingHeight));
          onLoaded();
        },
      });
    }, mountRef.current!);
    return host!;
  });

  // Only rows on screen run a widget (each holds a worker and tens of megabytes). One that leaves keeps its last render
  // as a picture; back on screen, a new run boots below it and takes its place once loaded, so the row never blanks.
  // A preview has no input or storage, so a new run draws the same first state (widget-sandbox sdk-v1 §2.16)
  useEffect(() => {
    if (!canRender || !isIntersecting) return undefined;
    let isCancelled = false;
    let isLoaded = false;
    let host: WidgetHost | undefined;

    function replacePicture() {
      isLoaded = true;
      pictureRef.current?.destroy();
      pictureRef.current = undefined;
    }

    void loadWidgetSandbox().then(({ WidgetHost: Runtime }) => {
      requestForcedReflow(() => {
        if (isCancelled) return;
        try {
          host = createHost(Runtime, () => isCancelled, replacePicture);
          hostRef.current = host;
        } catch {
          // A widget that cannot start is shown as the result's text
          setHasFailed(true);
        }
      });
    });

    return () => {
      isCancelled = true;
      hostRef.current = undefined;
      if (!host) return;
      if (!isLoaded) {
        host.destroy();
        return;
      }
      host.suspend();
      pictureRef.current = host;
    };
  }, [canRender, isIntersecting, html, createHost]);

  useEffect(() => () => pictureRef.current?.destroy(), []);

  useEffect(() => {
    hostRef.current?.setVisible(isVisible);
  }, [isVisible]);

  useEffect(() => {
    hostRef.current?.setData({ chatData: chatData || undefined, publicData: publicData || undefined });
  }, [chatData, publicData]);

  useEffect(() => {
    requestMeasure(() => {
      const root = rootRef.current;
      if (root && hostRef.current) hostRef.current.setTheme(buildWidgetTheme(root, theme));
    });
  }, [theme, messageTextSize]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(!document.hidden);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (!canRender || hasFailed) {
    return <ArticleResult focus={focus} inlineResult={inlineResult} onClick={onClick} />;
  }

  const widgetWidth = width ? `${Math.max(MIN_WIDTH, width) / REM}rem` : '100%';
  const widgetHeight = (height ? clampHeight(height) : naturalHeight) / REM;

  return (
    <ListItem
      focus={focus}
      className={buildClassName(styles.item, 'chat-item-clickable')}
      buttonClassName={styles.button}
      onMouseDown={preventMessageInputBlurWithBubbling}
      onClick={handleClick}
    >
      <div
        ref={rootRef}
        className={styles.preview}
        style={`--widget-width: ${widgetWidth}; --widget-height: ${widgetHeight}rem`}
        dir={lang.isRtl ? 'rtl' : 'ltr'}
        aria-label={inlineResult.title || lang('Widget')}
      >
        <div ref={mountRef} className={styles.mount} inert data-stricterdom-ignore />
      </div>
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  theme: selectTheme(global),
  messageTextSize: selectSharedSettings(global).messageTextSize,
  areWidgetsDisabled: global.appConfig.areWidgetsDisabled,
}))(WidgetResult));
