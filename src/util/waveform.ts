/* eslint-disable no-bitwise */

// Ref: https://github.com/telegramdesktop/tdesktop/blob/0743e71ab6b928d2ee5bae1aed991849b1e2b291/Telegram/SourceFiles/data/data_document.cpp#L1018
export function decodeWaveform(encoded5bit: Uint8Array) {
  const bitsCount = encoded5bit.length * 8;
  const valuesCount = Math.floor(bitsCount / 5);
  if (!valuesCount) {
    return [];
  }

  // Read each 5 bit of encoded5bit as 0-31 unsigned char.
  // We count the index of the byte in which the desired 5-bit sequence starts.
  // And then we read a uint16 starting from that byte to guarantee to get all of those 5 bits.
  //
  // BUT! if it is the last byte we have, we're not allowed to read a uint16 starting with it.
  // Because it will be an overflow (we'll access one byte after the available memory).
  // We see, that only the last 5 bits could start in the last available byte and be problematic.
  // So we read in a general way all the entries in a general way except the last one.
  const result = Array(valuesCount);
  const bitsData = encoded5bit;
  for (let i = 0, l = valuesCount - 1; i !== l; ++i) {
    const byteIndex = Math.floor((i * 5) / 8);
    const bitShift = Math.floor((i * 5) % 8);
    const value = bitsData[byteIndex] + (bitsData[byteIndex + 1] << 8);
    result[i] = ((value >> bitShift) & 0x1F);
  }
  const lastByteIndex = Math.floor(((valuesCount - 1) * 5) / 8);
  const lastBitShift = Math.floor(((valuesCount - 1) * 5) % 8);
  const lastValue = bitsData[lastByteIndex] + (bitsData[lastByteIndex + 1] << 8);
  result[valuesCount - 1] = (lastValue >> lastBitShift) & 0x1F;

  return result;
}

export function interpolateArray(data: number[], fitCount: number) {
  let peak = 0;
  const newData = new Array(fitCount);
  const springFactor = data.length / fitCount;
  const leftFiller = data[0];
  const rightFiller = data[data.length - 1];
  for (let i = 0; i < fitCount; i++) {
    const idx = Math.floor(i * springFactor);
    const val = ((data[idx - 1] ?? leftFiller) + (data[idx] ?? leftFiller) + (data[idx + 1] ?? rightFiller)) / 3;
    newData[i] = val;
    if (peak < val) {
      peak = val;
    }
  }
  return { data: newData, peak };
}
