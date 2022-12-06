import React, { memo, useRef } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiMessage } from '../../../api/types';
import type { ISettings } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { getMessageInvoice, getWebDocumentHash } from '../../../global/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';

import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';

import Skeleton from '../../ui/Skeleton';

import './Invoice.scss';

type OwnProps = {
  message: ApiMessage;
  shouldAffectAppendix?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ISettings['theme'];
};

const Invoice: FC<OwnProps> = ({
  message,
  shouldAffectAppendix,
  isInSelectMode,
  isSelected,
  theme,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const invoice = getMessageInvoice(message);

  const {
    title,
    text,
    amount,
    currency,
    isTest,
    photo,
  } = invoice!;

  const photoUrl = useMedia(getWebDocumentHash(photo));

  useLayoutEffectWithPrevDeps(([prevShouldAffectAppendix]) => {
    if (!shouldAffectAppendix) {
      if (prevShouldAffectAppendix) {
        ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!.removeAttribute(CUSTOM_APPENDIX_ATTRIBUTE);
      }
      return;
    }

    if (photoUrl) {
      const contentEl = ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!;
      getCustomAppendixBg(photoUrl, false, isInSelectMode, isSelected, theme).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    }
  }, [shouldAffectAppendix, photoUrl, isInSelectMode, isSelected, theme] as const);

  return (
    <div
      ref={ref}
      className="Invoice"
    >
      {title && (
        <p className="title">{renderText(title)}</p>
      )}
      {text && (
        <div>{renderText(text, ['emoji', 'br'])}</div>
      )}
      <div className={`description ${photo ? 'has-image' : ''}`}>
        {photoUrl && (
          <img
            className="invoice-image"
            src={photoUrl}
            alt=""
            crossOrigin="anonymous"
          />
        )}
        {!photoUrl && photo && (
          <Skeleton width={photo.dimensions?.width} height={photo.dimensions?.height} forceAspectRatio />
        )}
        <p className="description-text">
          {formatCurrency(amount, currency, lang.code)}
          {isTest && <span>{lang('PaymentTestInvoice')}</span>}
        </p>
      </div>
    </div>
  );
};

export default memo(Invoice);
