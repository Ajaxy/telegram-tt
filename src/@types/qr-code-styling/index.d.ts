export type QrCodeGradient = {
  type: 'linear' | 'radial';
  rotation?: number;
  colorStops: Array<{ offset: number; color: string }>;
};

type QrCodeFileExtension = 'png' | 'svg';

type QrCodeStylingOptions = {
  width?: number;
  height?: number;
  data?: string;
  image?: string;
  margin?: number;
  type?: 'svg' | 'canvas';
  dotsOptions?: {
    type?: string;
    color?: string;
    gradient?: QrCodeGradient;
  };
  cornersSquareOptions?: {
    type?: string;
    color?: string;
    gradient?: QrCodeGradient;
  };
  imageOptions?: {
    imageSize?: number;
    margin?: number;
  };
  qrOptions?: {
    errorCorrectionLevel?: string;
  };
};

export default class QrCodeStyling {
  constructor(options: QrCodeStylingOptions);

  update(options: QrCodeStylingOptions): void;

  append(container?: HTMLElement): void;

  getRawData(extension?: QrCodeFileExtension): Promise<Blob | undefined>;
}
