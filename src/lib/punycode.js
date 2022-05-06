/* eslint-disable no-nested-ternary */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/naming-convention */

const utf16 = {
  // The utf16-class is necessary to convert from javascripts internal character representation to unicode and back.
  decode: (input) => {
    const output = [];
    let i = 0;
    const len = input.length;
    let value;
    let extra;

    while (i < len) {
      value = input.charCodeAt(i++);
      if ((value & 0xf800) === 0xd800) {
        extra = input.charCodeAt(i++);
        if ((value & 0xfc00) !== 0xd800 || (extra & 0xfc00) !== 0xdc00) {
          throw new RangeError('UTF-16(decode): Illegal UTF-16 sequence');
        }
        value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
      }
      output.push(value);
    }
    return output;
  },
  encode: (input) => {
    const output = [];
    let i = 0;
    const len = input.length;
    let value;

    while (i < len) {
      value = input[i++];
      if ((value & 0xf800) === 0xd800) {
        throw new RangeError('UTF-16(encode): Illegal UTF-16 value');
      }
      if (value > 0xffff) {
        value -= 0x10000;
        output.push(String.fromCharCode(((value >>> 10) & 0x3ff) | 0xd800));
        value = 0xdc00 | (value & 0x3ff);
      }
      output.push(String.fromCharCode(value));
    }
    return output.join('');
  },
};

// Default parameters
const initial_n = 0x80;
const initial_bias = 72;
const delimiter = '\x2D';
const base = 36;
const damp = 700;
const tmin = 1;
const tmax = 26;
const skew = 38;
const maxint = 0x7fffffff;

// decode_digit(cp) returns the numeric value of a basic code
// point (for use in representing integers) in the range 0 to
// base-1, or base if cp is does not represent a value.

function decode_digit(cp) {
  return cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : base;
}

// ** Bias adaptation function **
function adapt(delta, numpoints, firsttime) {
  let k;
  delta = firsttime ? Math.floor(delta / damp) : delta >> 1;
  delta += Math.floor(delta / numpoints);

  for (k = 0; delta > ((base - tmin) * tmax) >> 1; k += base) {
    delta = Math.floor(delta / (base - tmin));
  }
  return Math.floor(k + ((base - tmin + 1) * delta) / (delta + skew));
}

// Main decode
function decode(input, preserveCase) {
  // Dont use utf16
  const output = [];
  const case_flags = [];
  const input_length = input.length;

  let n; let out; let i; let bias; let basic; let j; let ic; let oldi; let w; let k; let digit; let t; let len;

  // Initialize the state:

  n = initial_n;
  i = 0;
  bias = initial_bias;

  // Handle the basic code points: Let basic be the number of input code
  // points before the last delimiter, or 0 if there is none, then
  // copy the first basic code points to the output.

  basic = input.lastIndexOf(delimiter);
  if (basic < 0) basic = 0;

  for (j = 0; j < basic; ++j) {
    if (preserveCase) case_flags[output.length] = input.charCodeAt(j) - 65 < 26;
    if (input.charCodeAt(j) >= 0x80) {
      throw new RangeError('Illegal input >= 0x80');
    }
    output.push(input.charCodeAt(j));
  }

  // Main decoding loop: Start just after the last delimiter if any
  // basic code points were copied; start at the beginning otherwise.

  for (ic = basic > 0 ? basic + 1 : 0; ic < input_length;) {
    // ic is the index of the next character to be consumed,

    // Decode a generalized variable-length integer into delta,
    // which gets added to i. The overflow checking is easier
    // if we increase i as we go, then subtract off its starting
    // value at the end to obtain delta.
    for (oldi = i, w = 1, k = base; ; k += base) {
      if (ic >= input_length) {
        throw RangeError('punycode_bad_input(1)');
      }
      digit = decode_digit(input.charCodeAt(ic++));

      if (digit >= base) {
        throw RangeError('punycode_bad_input(2)');
      }
      if (digit > Math.floor((maxint - i) / w)) {
        throw RangeError('punycode_overflow(1)');
      }
      i += digit * w;
      t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
      if (digit < t) {
        break;
      }
      if (w > Math.floor(maxint / (base - t))) {
        throw RangeError('punycode_overflow(2)');
      }
      w *= base - t;
    }

    out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);

    // i was supposed to wrap around from out to 0,
    // incrementing n each time, so we'll fix that now:
    if (Math.floor(i / out) > maxint - n) {
      throw RangeError('punycode_overflow(3)');
    }
    n += Math.floor(i / out);
    i %= out;

    // Insert n at position i of the output:
    // Case of last character determines uppercase flag:
    if (preserveCase) {
      case_flags.splice(i, 0, input.charCodeAt(ic - 1) - 65 < 26);
    }

    output.splice(i, 0, n);
    i++;
  }
  if (preserveCase) {
    for (i = 0, len = output.length; i < len; i++) {
      if (case_flags[i]) {
        output[i] = String.fromCharCode(output[i])
          .toUpperCase()
          .charCodeAt(0);
      }
    }
  }
  return utf16.encode(output);
}

function toUnicode(domain) {
  const domain_array = domain.split('.');
  const out = [];
  for (let i = 0; i < domain_array.length; ++i) {
    const s = domain_array[i];
    out.push(s.match(/^xn--/) ? decode(s.slice(4)) : s);
  }
  return out.join('.');
}

export default toUnicode;
