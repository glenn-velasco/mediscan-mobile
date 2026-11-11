import sodium from 'libsodium-wrappers';

export * from 'libsodium-wrappers';
export const ready = sodium.ready;
export default sodium;
