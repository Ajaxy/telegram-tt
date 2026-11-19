import type { TeactNode } from '../../../../lib/teact/teact';
import { useEffect, useRef } from '../../../../lib/teact/teact';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';

import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLastCallback from '../../../../hooks/useLastCallback';
import useResizeObserver from '../../../../hooks/useResizeObserver';

import KeyboardShortcutReveal from './KeyboardShortcutReveal';

import styles from './SettingsKeyboardShortcuts.module.scss';

type OwnProps = {
  contentKey: string;
  children: TeactNode;
};

const KeyboardShortcutCrossfade = ({
  contentKey,
  children,
}: OwnProps) => {
  const ref = useRef<HTMLSpanElement>();
  const layersRef = useRef<HTMLSpanElement>();
  const layerChildrenRef = useRef(new Map<string, TeactNode>());
  const isMountedRef = useRef(false);
  const forceUpdate = useForceUpdate();

  layerChildrenRef.current.set(contentKey, children);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  useResizeObserver(layersRef, (entry) => {
    const { inlineSize, blockSize } = entry.borderBoxSize[0];

    requestMutation(() => {
      const element = ref.current;
      if (!element) return;

      element.style.width = `${inlineSize}px`;
      element.style.height = `${blockSize}px`;
    });
  });

  const removeLayer = useLastCallback((key: string) => {
    if (key === contentKey) return;

    layerChildrenRef.current.delete(key);
    forceUpdate();
  });

  return (
    <span ref={ref} className={styles.crossfade}>
      <span ref={layersRef} className={styles.layers} teactFastList>
        {Array.from(layerChildrenRef.current, ([key, layerChildren]) => (
          <KeyboardShortcutReveal
            key={key}
            isOpen={key === contentKey}
            className={buildClassName(styles.layer, isMountedRef.current && styles.layerEnter)}
            onCloseAnimationEnd={() => removeLayer(key)}
          >
            {layerChildren}
          </KeyboardShortcutReveal>
        ))}
      </span>
    </span>
  );
};

export default KeyboardShortcutCrossfade;
