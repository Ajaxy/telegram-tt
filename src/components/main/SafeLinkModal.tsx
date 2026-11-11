import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import convertPunycode from '../../lib/punycode';
import { selectTabState } from '../../global/selectors';
import {
  ensureProtocol, getSuspiciousDomainCharacters, hasSuspiciousUrlCredentials, isSuspiciousUrl,
} from '../../util/browser/url';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal, {
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

import styles from './SafeLinkModal.module.scss';

export type OwnProps = {
  modal: string;
  isOpen: boolean;
};

type StateProps = {
  isWidget?: boolean;
};

const URL_PARTS_PATTERN = /^([a-z][a-z\d+.-]*:\/\/)([^/?#]*@)?(\[[^\]]+\]|[^:/?#]+)(.*)$/i;
const INVISIBLE_CHARACTER_PATTERN = /[\p{Default_Ignorable_Code_Point}\p{Cc}]/gu;

const SafeLinkModal = ({ modal, isOpen, isWidget }: OwnProps & StateProps) => {
  const { toggleSafeLinkModal } = getActions();

  const lang = useLang();
  const renderedUrl = useMemo(() => (isWidget ? modal : renderUrl(modal)), [isWidget, modal]);
  const isSuspicious = useMemo(() => isSuspiciousUrl(modal), [modal]);

  const handleOpen = useLastCallback(() => {
    window.open(ensureProtocol(modal), '_blank', 'noopener noreferrer');
    toggleSafeLinkModal({ url: undefined });
  });

  const handleDismiss = useLastCallback(() => {
    toggleSafeLinkModal({ url: undefined });
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalTitle>{lang('OpenUrlTitle')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      ariaLabel={lang('OpenUrlTitle')}
      onClose={handleDismiss}
    >
      {renderText(lang('OpenUrlText', {
        url: <span className={styles.url} dir="ltr">{renderedUrl}</span>,
      }, { withNodes: true, withMarkdown: true }))}
      {isSuspicious && (
        <p className={styles.warning}>
          <Icon className={buildClassName(styles.riskIcon, 'in-text-icon')} name="info-filled" />
          {lang('OpenUrlWarning')}
        </p>
      )}
      <ModalFooterActions>
        <Button isText size="smaller" color="primary" fluid onClick={handleDismiss}>
          {lang('Cancel')}
        </Button>
        <Button isText size="smaller" color="primary" fluid autoFocus onClick={handleOpen}>
          {lang('OpenUrlConfirm')}
        </Button>
      </ModalFooterActions>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  isWidget: selectTabState(global).safeLinkModalIsWidget,
}))(SafeLinkModal));

function renderUrl(url: string) {
  try {
    // Split the serialized URL so highlighting follows the browser's actual destination
    const parsedUrl = new URL(ensureProtocol(url));
    const parts = parsedUrl.href.match(URL_PARTS_PATTERN);
    if (!parts) return formatUrlPart(parsedUrl.href);

    const [, protocol, credentials, hostname, suffix] = parts;
    const domain = convertPunycode(hostname);

    return (
      <>
        {protocol}
        {credentials && (
          <>
            <span className={hasSuspiciousUrlCredentials(parsedUrl) ? styles.suspicious : undefined}>
              {formatUrlPart(credentials.slice(0, -1))}
            </span>
            @
          </>
        )}
        <span className={styles.domain}>
          {domain.split('.').map((label, index) => (
            <>
              {index > 0 && '.'}
              {renderDomainLabel(label)}
            </>
          ))}
        </span>
        {formatUrlPart(suffix)}
      </>
    );
  } catch (err) {
    return <span className={styles.suspicious}>{formatUrlPart(url)}</span>;
  }
}

function renderDomainLabel(label: string) {
  const suspiciousCharacters = getSuspiciousDomainCharacters(label);
  if (!suspiciousCharacters.size) return formatUrlPart(label);

  return Array.from(label, (character) => (
    suspiciousCharacters.has(character)
      ? <span className={styles.suspicious}>{formatUrlPart(character)}</span>
      : character
  ));
}

function formatUrlPart(part: string) {
  let decodedPart = part;
  try {
    decodedPart = decodeURI(part);
  } catch (err) {
    // Malformed escape sequences remain visible
  }

  // Keep invisible and direction-changing characters visible instead of letting them disguise the URL
  return decodedPart.replace(INVISIBLE_CHARACTER_PATTERN, encodeURIComponent);
}
