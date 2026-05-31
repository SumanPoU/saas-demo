import { createStream, type Options } from 'rotating-file-stream';
import * as path from 'path';

export function buildFileStream() {
  return createStream(
    (time: number | Date | null, index?: number) => {
      const date =
        time instanceof Date ? time : time ? new Date(time) : new Date();
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const suffix = index ? `-${index}` : '';

      return `${dateString}${path.sep}app${suffix}.log`;
    },
    {
      path: 'logs',
      interval: '1d',
      intervalBoundary: true,
      initialRotation: true,
      compress: 'gzip',
      maxFiles: 30,
    },
  );
}
