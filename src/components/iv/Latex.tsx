import temmlUrl from 'temml/dist/temml.mjs?url';
import { memo, useEffect, useRef } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';

import styles from './RichContent.module.scss';

type OwnProps = {
  source: string;
  isBlock?: boolean;
};

type TemmlModule = typeof import('temml');

let temmlPromise: Promise<TemmlModule> | undefined;

function ensureTemml() {
  if (!temmlPromise) {
    temmlPromise = Promise.all([
      // Vite breaks Temml on build. https://github.com/ronkok/Temml/pull/128
      import(/* @vite-ignore */ temmlUrl) as Promise<TemmlModule>,
      import('temml/dist/Temml-Local.css'),
    ]).then(([temml]) => temml);
  }

  return temmlPromise;
}

function Latex({ source, isBlock }: OwnProps) {
  const ref = useRef<HTMLSpanElement>();

  useEffect(() => {
    let isCancelled = false;

    void ensureTemml().then(({ default: temml }) => {
      requestMutation(() => {
        if (isCancelled) return;

        const element = ref.current!;
        element.textContent = '';

        try {
          temml.render(source, element, {
            displayMode: isBlock,
            throwOnError: true,
          });
        } catch {
          element.textContent = source;
        }
      });
    }, () => {
      requestMutation(() => {
        if (isCancelled) return;

        ref.current!.textContent = source;
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [isBlock, source]);

  return (
    <span
      ref={ref}
      className={buildClassName(styles.latex, isBlock && styles.latexBlock)}
    />
  );
}

export default memo(Latex);
