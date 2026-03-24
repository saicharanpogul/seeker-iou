// Must be imported before @solana/web3.js or any Solana packages.
// React Native doesn't have Buffer, crypto.getRandomValues, or URL globals.

import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";

global.Buffer = global.Buffer || Buffer;

// TextEncoder/TextDecoder polyfill
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
