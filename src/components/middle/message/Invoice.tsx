import { memo, useRef } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import type { ThemeKey } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getMediaDimensions, getMessageInvoice, getWebDocumentHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';

import useLang from '../../../hooks/useLang';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';

import Skeleton from '../../ui/placeholder/Skeleton';

import './Invoice.scss';
import mediaStyles from './media.module.scss';

type OwnProps = {
  message: ApiMessage;
  shouldAffectAppendix?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ThemeKey;
};

const Invoice = ({
  message,
  shouldAffectAppendix,
  isInSelectMode,
  isSelected,
  theme,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const oldLang = useOldLang();
  const lang = useLang();
  const invoice = getMessageInvoice(message);

  const {
    title,
    description,
    amount,
    currency,
    isTest,
    photo,
  } = invoice!;

  const photoUrl = useMedia(getWebDocumentHash(photo));
  const mediaDimensions = photo ? getMediaDimensions(photo) : undefined;
  const messageId = message.id;

  useLayoutEffectWithPrevDeps(([prevShouldAffectAppendix]) => {
    if (!shouldAffectAppendix) {
      if (prevShouldAffectAppendix) {
        ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!.removeAttribute(CUSTOM_APPENDIX_ATTRIBUTE);
      }
      return;
    }

    if (photoUrl) {
      const contentEl = ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!;
      getCustomAppendixBg(photoUrl, false, messageId, isSelected, theme).then((appendixBg) => {
        requestMutation(() => {
          contentEl.style.setProperty('--appendix-bg', appendixBg);
          contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
        });
      });
    }
  }, [shouldAffectAppendix, photoUrl, isInSelectMode, isSelected, theme, messageId]);

  const mediaStyle = mediaDimensions && buildStyle(
    `--media-width: ${mediaDimensions.width}px`,
    `--media-aspect-ratio: ${mediaDimensions.width / mediaDimensions.height}`,
  );

  return (
    <div
      ref={ref}
      className="Invoice"
    >
      {title && (
        <p className="title">{renderText(title)}</p>
      )}
      {description && (
        <div className="info">{renderText(description, ['emoji', 'br'])}</div>
      )}
      <div className={`description ${photo ? 'has-image' : ''}`}>
        {Boolean(photo) && (
          <div
            className={buildClassName(
              'invoice-image-container', mediaStyles.frame,
            )}
            style={mediaStyle}
          >
            {photoUrl && (
              <img
                className="invoice-image full-media"
                src={photoUrl}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
              />
            )}
            {!photoUrl && photo && (
              <Skeleton
                className="invoice-image-placeholder"
                animation="pulse"
              />
            )}
          </div>
        )}
        <p className="description-text">
          {formatCurrency(lang, amount, currency, { iconClassName: 'invoice-currency-icon' })}
          {isTest && <span className="test-invoice">{oldLang('PaymentTestInvoice')}</span>}
        </p>
      </div>
    </div>
  );
};

export default memo(Invoice);
