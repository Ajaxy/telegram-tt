import renderText from '../common/helpers/renderText';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';

import './AppInactive.scss';

import appInactivePath from '../../assets/app-inactive.png';

type OwnProps = {
  inactiveReason: 'auth' | 'otherClient';
};

const AppInactive = ({ inactiveReason }: OwnProps) => {
  const lang = useLang();

  const handleReload = useLastCallback(() => {
    window.location.reload();
  });

  useHistoryBack({
    isActive: true,
    onBack: handleReload,
    shouldResetUrlHash: true,
  });

  return (
    <div id="AppInactive">
      <div className="content">
        <img src={appInactivePath} alt="" />
        <h3 className="title">
          {inactiveReason === 'auth' ? lang('AppInactiveAuthTitle') : lang('AppInactiveOtherClientTitle')}
        </h3>
        <div className="description">
          {renderText(
            lang(inactiveReason === 'auth' ? 'AppInactiveAuthDescription' : 'AppInactiveOtherClientDescription'),
            ['br'],
          )}
        </div>
        <div className="actions">
          <Button isText ripple onClick={handleReload}>
            {lang('AppInactiveReload')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppInactive;
