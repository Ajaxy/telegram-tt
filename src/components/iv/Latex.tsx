import { memo, useEffect, useRef } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import renderLatex from '../../util/renderLatex';

import styles from './RichContent.module.scss';

type OwnProps = {
  source: string;
  isBlock?: boolean;
};

function Latex({ source, isBlock }: OwnProps) {
  const ref = useRef<HTMLSpanElement>();

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      renderLatex(source, isBlock, controller.signal),
      import('temml/dist/Temml-Local.css'),
    ]).then(([markup]) => {
      requestMutation(() => {
        if (controller.signal.aborted) return;

        const element = ref.current!;
        if (markup === undefined) {
          element.textContent = source;
        } else {
          element.innerHTML = markup;
        }
      });
    }, () => {
      requestMutation(() => {
        if (controller.signal.aborted) return;

        ref.current!.textContent = source;
      });
    });

    return () => {
      controller.abort();
    };
  }, [isBlock, source]);

  return (
    <span
      ref={ref}
      className={buildClassName(styles.latex, isBlock && styles.latexBlock)}
      data-rich-text-type={isBlock ? undefined : 'math'}
      data-source={source}
    />
  );
}

export default memo(Latex);
