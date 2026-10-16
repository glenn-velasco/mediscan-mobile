import { generateQrImage } from '@/features/qr-widget/qr-image-generator';

jest.mock('@shopify/react-native-skia', () => ({
  ImageFormat: { PNG: 'png' },
  Skia: {
    Color: (color: string) => color,
    Paint: () => ({ setColor: jest.fn() }),
    Path: { MakeFromSVGString: () => ({}) },
    Surface: {
      Make: () => ({
        getCanvas: () => ({
          drawRect: jest.fn(),
          save: jest.fn(),
          translate: jest.fn(),
          drawPath: jest.fn(),
          restore: jest.fn(),
        }),
        makeImageSnapshot: () => ({ encodeToBase64: () => 'cG5n' }),
      }),
    },
    XYWHRect: jest.fn(),
  },
}));

jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const createOptions: unknown[] = [];

  class Directory {
    uri: string;

    constructor(uri: string | { uri: string }) {
      this.uri = typeof uri === 'string' ? uri : uri.uri;
    }

    get exists() {
      return true;
    }

    create() {}
  }

  class File {
    uri: string;

    constructor(directory: Directory, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }

    create(options: { overwrite?: boolean } = {}) {
      createOptions.push(options);
      if (files.has(this.uri) && !options.overwrite) {
        throw new Error('File already exists');
      }
      files.set(this.uri, '');
    }

    write(content: string) {
      files.set(this.uri, content);
    }
  }

  return {
    Directory,
    File,
    Paths: { document: { uri: 'file:///documents' } },
    __files: files,
    __createOptions: createOptions,
  };
});

jest.mock('expo-widgets', () => ({ widgetsDirectory: '' }));

describe('generateQrImage', () => {
  const fileSystem = jest.requireMock('expo-file-system') as {
    __files: Map<string, string>;
    __createOptions: unknown[];
  };

  beforeEach(() => {
    fileSystem.__files.clear();
    fileSystem.__createOptions.length = 0;
  });

  it('overwrites the persistent QR image when generating it more than once', async () => {
    const firstPath = await generateQrImage('first QR payload');
    const secondPath = await generateQrImage('updated QR payload');

    expect(firstPath).toBe('file:///documents/emergency_qr.png');
    expect(secondPath).toBe(firstPath);
    expect(fileSystem.__createOptions).toEqual([{ overwrite: true }, { overwrite: true }]);
    expect(fileSystem.__files.get('file:///documents/emergency_qr.png')).toBe('cG5n');
  });
});
