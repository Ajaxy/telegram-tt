import useLang from '../../hooks/useLang';

import Button from './Button';

import './ShowMoreButton.scss';

type OwnProps = {
  text: string;
  isLoading?: boolean;
  onClick: () => void;
};

const ShowMoreButton = ({
  text,
  isLoading,
  onClick,
}: OwnProps) => {
  const lang = useLang();

  return (
    <Button
      className="ShowMoreButton"
      color="translucent"
      isText
      isLoading={isLoading}
      isRtl={lang.isRtl}
      onClick={onClick}
      iconName="down"
    >
      {text}
    </Button>
  );
};

export default ShowMoreButton;
