import buildClassName from '../../util/buildClassName';

import styles from './Spinner.module.scss';

type OwnProps = {
  color?: 'blue' | 'white' | 'black' | 'green' | 'gray' | 'yellow';
  backgroundColor?: 'light' | 'dark';
  className?: string;
};

const Spinner = ({
  color = 'blue',
  backgroundColor,
  className,
}: OwnProps) => {
  return (
    <div className={buildClassName(
      'Spinner',
      styles.root,
      color && styles[color],
      backgroundColor && styles.withBackground,
      backgroundColor && styles[`${backgroundColor}Bg`],
      className,
    )}
    >
      <div className={buildClassName('Spinner__inner', styles.inner)} />
    </div>
  );
};

export default Spinner;
