import {streamAssetRecords} from '../../src/stream-format.js';
export const MAX_STATIC_ASSET_BYTES=25*1024*1024;
export function assertStreamAssetSizes(manifest) {
  for(const record of streamAssetRecords(manifest)) if(record.bytes>MAX_STATIC_ASSET_BYTES) {
    throw new Error(`Streaming asset ${record.file} exceeds the 25 MiB static asset limit (${record.bytes} bytes)`);
  }
}
