import { memo } from '../../lib/teact/teact';

import type { ApiFakeType } from '../../api/types';

import useLang from '../../hooks/useLang';

import './FakeIcon.scss';

type OwnProps = {
  fakeType: ApiFakeType;
};

const FakeIcon = ({
  fakeType,
}: OwnProps) => {
  const lang = useLang();

  return (
    <span className="FakeIcon">
      {lang(fakeType === 'fake' ? 'FakeMessage' : 'ScamMessage')}
    </span>
  );
};

export default memo(FakeIcon);
