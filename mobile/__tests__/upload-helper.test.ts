import * as ImageManipulator from 'expo-image-manipulator';
import {
  compressAndStripExif,
  uploadImageWithSignedUrl,
  MAX_PHOTO_BYTES,
  MAX_DIMENSION_PX,
} from '../src/utils/upload-helper';
import * as client from '../src/api/client';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('Upload Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compresses and resizes to max 1600px width JPEG', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///processed.jpg',
      width: 1600,
      height: 1200,
    });

    const uri = await compressAndStripExif('file:///original.png');

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///original.png',
      [{ resize: { width: MAX_DIMENSION_PX } }],
      {
        compress: 0.8,
        format: 'jpeg',
      }
    );
    expect(uri).toBe('file:///processed.jpg');
  });

  it('rejects images exceeding 5 MB limit after compression', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///huge.jpg',
    });

    // Mock fetch for blob
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === 'file:///huge.jpg') {
        return Promise.resolve({
          blob: () => Promise.resolve({ size: MAX_PHOTO_BYTES + 1024 }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await expect(uploadImageWithSignedUrl('file:///huge.jpg', 'METER_PHOTO')).rejects.toThrow(
      /exceeds 5 MB limit/i
    );
  });

  it('retries on initial PUT upload failure and succeeds on retry', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///normal.jpg',
    });

    let putCallCount = 0;
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (url === 'file:///normal.jpg') {
        return Promise.resolve({
          blob: () => Promise.resolve({ size: 50000 }),
        });
      }
      if (opts?.method === 'PUT') {
        putCallCount++;
        if (putCallCount === 1) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.resolve({ ok: true });
    });

    jest.spyOn(client, 'apiFetch').mockResolvedValue({
      uploadUrl: 'https://storage.example.com/put-target',
      key: 'METER_PHOTO/user1/test.jpg',
      expiresInSeconds: 900,
    } as any);

    const key = await uploadImageWithSignedUrl('file:///normal.jpg', 'METER_PHOTO');

    expect(key).toBe('METER_PHOTO/user1/test.jpg');
    expect(putCallCount).toBe(2); // Retried once and succeeded!
  });
});
