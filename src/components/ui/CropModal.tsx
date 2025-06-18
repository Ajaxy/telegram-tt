import {
  memo,
} from '../../lib/teact/teact';

import useImageLoader from '../../hooks/useImageLoader';
import useLang from '../../hooks/useLang';

import ImageCropper from './ImageCropper';
import Modal from './Modal';

import './CropModal.scss';

type OwnProps = {
  file?: Blob;
  onChange: (file: File) => void;
  onClose: () => void;
};

const MAX_OUTPUT_SIZE = 1024;
const MIN_OUTPUT_SIZE = 256;

const CropModal = ({ file, onChange, onClose }: OwnProps) => {
  const lang = useLang();
  const { image } = useImageLoader(file);
  const isOpen = Boolean(file) && Boolean(image);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lang('CropperTitle')}
      className="CropModal"
      hasCloseButton
      isCondensedHeader
    >
      <ImageCropper
        onChange={onChange}
        image={image}
        maxOutputSize={MAX_OUTPUT_SIZE}
        minOutputSize={MIN_OUTPUT_SIZE}
      />
    </Modal>
  );
};

export default memo(CropModal);
