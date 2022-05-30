import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import buildClassName from '../../../util/buildClassName';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';

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

  function handleSend() {
    if (!rating) {
      closeCallRatingModal();
      return;
    }
    setCallRating({
      rating: rating + 1,
      comment: inputRef.current?.value || '',
    });
  }

  function handleClickStar(index: number) {
    return () => setRating(rating === index ? undefined : index);
  }

  return (
    <Modal title={lang('lng_call_rate_label')} className="narrow" onClose={closeCallRatingModal} isOpen={isOpen}>
      <div className={styles.stars}>
        {new Array(5).fill(undefined).map((_, i) => {
          const isFilled = rating !== undefined && rating >= i;
          return (
            <i
              className={buildClassName(
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

      {/* eslint-disable-next-line react/jsx-no-bind */}
      <Button className="confirm-dialog-button" isText onClick={handleSend}>
        {lang('Send')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={closeCallRatingModal}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(RatePhoneCallModal);
