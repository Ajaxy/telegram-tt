export default function unloadVideo(video: HTMLVideoElement) {
  video.pause();
  // https://github.com/shaka-project/shaka-player/commit/0e3d10e61cb08cc35750e48face4e58f24542fc8
  video.removeAttribute('src');
  video.load();
}
