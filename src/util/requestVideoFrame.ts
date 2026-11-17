export default function requestVideoFrame(video: HTMLVideoElement, callback: NoneToVoidFunction) {
  if ('requestVideoFrameCallback' in video) {
    const handle = video.requestVideoFrameCallback(callback);
    return () => video.cancelVideoFrameCallback(handle);
  }

  const handle = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(handle);
}
