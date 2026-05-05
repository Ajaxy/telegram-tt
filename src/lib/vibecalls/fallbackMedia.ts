// https://blog.mozilla.org/webrtc/warm-up-with-replacetrack/

export const silence = (ctx: AudioContext) => {
  const oscillator = ctx.createOscillator();
  const dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return new MediaStream([Object.assign((dst as any).stream.getAudioTracks()[0], { enabled: false })]);
};

export const black = ({ width = 640, height = 480 } = {}) => {
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Cannot create canvas ctx');

  ctx.fillRect(0, 0, width, height);
  const stream = canvas.captureStream();
  return new MediaStream([Object.assign(stream.getVideoTracks()[0], { enabled: false })]);
};
