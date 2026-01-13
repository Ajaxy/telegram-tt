interface PreviewFrameInfo {
  top: number;
  left: number;
  width: number;
  height: number;
  time: number;
}

export default class StoryboardParser {
  private frames: PreviewFrameInfo[];

  /**
   * Can throw error if the storyboard map data is invalid
   */
  constructor(storyboardMapData: string) {
    const [_file, widthLine, heightLine, ...frameLines] = storyboardMapData.split('\n');
    const width = Number.parseFloat(widthLine.split('=')[1]);
    const height = Number.parseFloat(heightLine.split('=')[1]);

    if (Number.isNaN(width) || Number.isNaN(height)) {
      throw new Error('Invalid storyboard map frame size');
    }

    this.frames = frameLines.map((frame) => {
      if (!frame.trim().length) {
        return undefined;
      }

      const [timeStr, leftStr, topStr] = frame.split(',');
      const info = {
        time: Number.parseFloat(timeStr),
        left: Number.parseInt(leftStr, 10),
        top: Number.parseInt(topStr, 10),
        width,
        height,
      };

      if (Number.isNaN(info.time) || Number.isNaN(info.left) || Number.isNaN(info.top)) {
        throw new Error('Invalid storyboard map data');
      }
      return info;
    }).filter(Boolean);

    if (this.frames.length === 0) {
      throw new Error('Missing frames in storyboard map data');
    }
  }

  getNearestPreview(time: number): PreviewFrameInfo {
    // Binary search for the nearest frame
    let left = 0;
    let right = this.frames.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.frames[mid].time <= time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return this.frames[Math.max(0, left - 1)];
  }
}
