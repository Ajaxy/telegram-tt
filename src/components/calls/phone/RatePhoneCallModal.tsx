import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';

import styles from './RatePhoneCallModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

const RatePhoneCallModal: FC<OwnProps> = ({
  isOpen,
}) => {
  const { closeCallRatingModal, setCallRating } = getActions();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = useLang();
  const [rating, setRating] = useState<number | undefined>();

  const handleSend = useCallback(() => {
    if (!rating) {
      closeCallRatingModal();
      return;
    }
    setCallRating({
      rating: rating + 1,
      comment: inputRef.current?.value || '',
    });
  }, [closeCallRatingModal, rating, setCallRating]);

  function handleClickStar(index: number) {
    return () => setRating(rating === index ? undefined : index);
  }

  const handleCancelClick = useCallback(() => {
    closeCallRatingModal();
  }, [closeCallRatingModal]);

  return (
    <Modal title={lang('lng_call_rate_label')} className="narrow" onClose={closeCallRatingModal} isOpen={isOpen}>
      <div className={styles.stars}>
        {new Array(5).fill(undefined).map((_, i) => {
          const isFilled = rating !== undefined && rating >= i;
          return (
            <i
              className={buildClassName(
                'icon',
                isFilled ? 'icon-favorite-filled' : 'icon-favorite',
                isFilled && styles.isFilled,
                styles.star,
              )}
              onClick={handleClickStar(i)}
            />
          );
        })}
      </div>
      <InputText
        ref={inputRef}
        placeholder={lang('lng_call_rate_comment')}
        className={buildClassName(styles.comment, rating !== 4 && rating !== undefined && styles.visible)}
      />

      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" isText onClick={handleSend}>
          {lang('Send')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={handleCancelClick}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(RatePhoneCallModal);
