import { memo, useRef } from '../../../lib/teact/teact';

import type { ApiFactCheck, ApiPeerColor } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useCollapsibleLines from '../../../hooks/element/useCollapsibleLines';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import Separator from '../../ui/Separator';

import styles from './FactCheck.module.scss';

type OwnProps = {
  factCheck: ApiFactCheck;
  isToggleDisabled?: boolean;
};

const COLOR: ApiPeerColor = {
  type: 'regular',
  color: 0,
};
const MAX_LINES = 4;

const FactCheck = ({ factCheck, isToggleDisabled }: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const cutoutRef = useRef<HTMLDivElement>();
  const {
    isCollapsed, isCollapsible, setIsCollapsed,
  } = useCollapsibleLines(ref, MAX_LINES, { cutoutRef });

  const countryLocalized = factCheck.countryCode ? lang.region(factCheck.countryCode) : undefined;

  const canExpand = !isToggleDisabled && isCollapsed;

  const handleExpand = useLastCallback(() => {
    setIsCollapsed(false);
  });

  const handleToggle = useLastCallback(() => {
    setIsCollapsed((prev) => !prev);
  });

  if (!factCheck.text) {
    return undefined;
  }

  return (
    <PeerColorWrapper peerColor={COLOR} className={styles.root} onClick={canExpand ? handleExpand : undefined}>
      <div
        ref={cutoutRef}
        className={buildClassName(styles.cutoutWrapper, isCollapsed && styles.collapsed)}
      >
        <div className={styles.title}>{lang('FactCheck')}</div>
        <div ref={ref} className={styles.content}>
          {renderTextWithEntities({
            text: factCheck.text.text,
            entities: factCheck.text.entities,
          })}
        </div>
        <Separator className={styles.separator} />
        <div className={styles.footnote}>{lang('FactCheckFooter', { country: countryLocalized })}</div>
      </div>
      {isCollapsible && (
        <div
          className={buildClassName(styles.collapseIcon, !isToggleDisabled && styles.clickable)}
          onClick={!isToggleDisabled ? handleToggle : undefined}
          aria-hidden
        >
          <Icon name={isCollapsed ? 'down' : 'up'} />
        </div>
      )}
    </PeerColorWrapper>
  );
};

export default memo(FactCheck);
