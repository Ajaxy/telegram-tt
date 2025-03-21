import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import type { ISettings } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getMessageInvoice, getWebDocumentHash } from '../../../global/helpers';
import buildStyle from '../../../util/buildStyle';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';

import useLang from '../../../hooks/useLang';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Skeleton from '../../ui/placeholder/Skeleton';

import './Invoice.scss';

type OwnProps = {
  message: ApiMessage;
  shouldAffectAppendix?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ISettings['theme'];
  forcedWidth?: number;
};

const Invoice: FC<OwnProps> = ({
  message,
  shouldAffectAppendix,
  isInSelectMode,
  isSelected,
  theme,
  forcedWidth,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

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
  const withBlurredBackground = Boolean(forcedWidth);
  const blurredBackgroundRef = useBlurredMediaThumbRef(photoUrl, !withBlurredBackground);
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

  const width = forcedWidth || photo?.dimensions?.width;

  const style = buildStyle(
    photo?.dimensions && `width: ${width}px`,
    photo?.dimensions && `aspect-ratio: ${photo.dimensions.width} / ${photo.dimensions.height}`,
    Boolean(!photo?.dimensions && forcedWidth) && `width: ${forcedWidth}px`,
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
          <div className="invoice-image-container">
            {withBlurredBackground && <canvas ref={blurredBackgroundRef} className="thumbnail blurred-bg" />}
            {photoUrl && (
              <img
                className="invoice-image"
                src={photoUrl}
                alt=""
                style={style}
                crossOrigin="anonymous"
                draggable={false}
              />
            )}
            {!photoUrl && photo && (
              <Skeleton
                width={width}
                height={photo.dimensions?.height}
                forceAspectRatio
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
