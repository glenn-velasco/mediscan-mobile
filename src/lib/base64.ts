import CryptoJS from 'crypto-js';

/** react-native-ble-plx characteristic values are base64 strings on the wire; our chunk protocol operates on plain UTF-8 text. */
export function utf8ToBase64(value: string): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(value));
}

export function base64ToUtf8(value: string): string {
  return CryptoJS.enc.Base64.parse(value).toString(CryptoJS.enc.Utf8);
}
