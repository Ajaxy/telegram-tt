import buildClassName from '../../util/buildClassName';

import './Spinner.scss';

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
      'Spinner', className, color, backgroundColor && 'with-background', backgroundColor && `bg-${backgroundColor}`,
    )}
    >
      <div className="Spinner__inner" />
    </div>
  );
};

export default Spinner;
