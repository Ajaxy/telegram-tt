import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useState, memo, useCallback,
} from '../../lib/teact/teact';

import { DEBUG } from '../../config';
import { blobToFile, blobToDataUri } from '../../util/files';
import useLang from '../../hooks/useLang';

import Button from './Button';
import Modal from './Modal';
import Loading from './Loading';

import './CropModal.scss';

// Change to 'base64' to get base64-encoded string
const cropperResultOptions: Croppie.ResultOptions & { type: 'blob' } = {
  type: 'blob',
  quality: 1,
  format: 'jpeg',
  circle: false,
  size: { width: 1024, height: 1024 },
};

type ICroppie = typeof import('croppie');
let Croppie: ICroppie;
let croppiePromise: Promise<{ default: ICroppie }>;

async function ensureCroppie() {
  if (!croppiePromise) {
    croppiePromise = import('../../lib/croppie') as unknown as Promise<{ default: ICroppie }>;
    Croppie = (await croppiePromise).default;
  }

  return croppiePromise;
}

let cropper: Croppie;

async function initCropper(imgFile: File) {
  try {
    const cropContainer = document.getElementById('avatar-crop');
    if (!cropContainer) {
      return;
    }

    const { offsetWidth, offsetHeight } = cropContainer;

    cropper = new Croppie(cropContainer, {
      enableZoom: true,
      boundary: {
        width: offsetWidth,
        height: offsetHeight,
      },
      viewport: {
        width: offsetWidth - 16,
        height: offsetHeight - 16,
        type: 'circle',
      },
    });

    const dataUri = await blobToDataUri(imgFile);
    await cropper.bind({ url: dataUri });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}

type OwnProps = {
  file?: File;
  onChange: (file: File) => void;
  onClose: () => void;
};

const CropModal: FC<OwnProps> = ({ file, onChange, onClose }: OwnProps) => {
  const [isCroppieReady, setIsCroppieReady] = useState(false);

  useEffect(() => {
    if (!file) {
      return;
    }

    if (!isCroppieReady) {
      ensureCroppie().then(() => setIsCroppieReady(true));

      return;
    }

    initCropper(file);
  }, [file, isCroppieReady]);

  const lang = useLang();

  const handleCropClick = useCallback(async () => {
    if (!cropper) {
      return;
    }

    const result: Blob | string = await cropper.result(cropperResultOptions);
    const croppedImg = typeof result === 'string' ? result : blobToFile(result, 'avatar.jpg');

    onChange(croppedImg);
  }, [onChange]);

  return (
    <Modal
      isOpen={Boolean(file)}
      onClose={onClose}
      title="Drag to reposition"
      className="CropModal"
      hasCloseButton
    >
      {isCroppieReady ? (
        <div id="avatar-crop" />
      ) : (
        <Loading />
      )}
      <Button
        className="confirm-button"
        round
        color="primary"
        onClick={handleCropClick}
        ariaLabel={lang('CropImage')}
      >
        <i className="icon-check" />
      </Button>
    </Modal>
  );
};

export default memo(CropModal);
