import safePlay from '../../../../util/safePlay';

const TRIM_LOOP_END_EPSILON = 0.05; // s

export default function loopVideoInTrim(video: HTMLVideoElement, start: number, end: number) {
  let frameHandle = 0;
  const keepInTrim = () => {
    if (!video.paused && video.currentTime >= end - TRIM_LOOP_END_EPSILON) {
      video.currentTime = start;
    }
    frameHandle = requestAnimationFrame(keepInTrim);
  };
  const handleEnded = () => {
    video.currentTime = start;
    safePlay(video);
  };

  frameHandle = requestAnimationFrame(keepInTrim);
  video.addEventListener('ended', handleEnded);

  return () => {
    cancelAnimationFrame(frameHandle);
    video.removeEventListener('ended', handleEnded);
  };
}
