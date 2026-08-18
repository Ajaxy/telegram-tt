import type { TeactNode } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import Icon from '../icons/Icon';

import styles from './Pullquote.module.scss';

type OwnProps = {
  className?: string;
  children: TeactNode;
};

const Pullquote = ({ className, children }: OwnProps) => {
  return (
    <aside className={buildClassName(styles.root, 'pullquote', className)} data-pullquote>
      <Icon name="quote-open" className={buildClassName(styles.quote, styles.quoteOpen)} />
      <div className={styles.content} data-rich-copy-wrapper>
        {children}
      </div>
      <Icon name="quote-close" className={buildClassName(styles.quote, styles.quoteClose)} />
    </aside>
  );
};

export default Pullquote;
