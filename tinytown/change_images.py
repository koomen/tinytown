"""Validate screenshot uploads without changing their original bytes."""
import base64
import binascii
from io import BytesIO
import uuid
import warnings

MAX_COUNT = 8
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_BYTES = 20 * 1024 * 1024
MAX_BODY_BYTES = 4 * ((MAX_TOTAL_BYTES + 2) // 3) + 100000
FORMATS = {'PNG': ('image/png', 'png'), 'JPEG': ('image/jpeg', 'jpg'), 'WEBP': ('image/webp', 'webp')}


def decode_uploads(uploads, existing=()):
    if uploads is None:
        return []
    if not isinstance(uploads, list) or len(existing) + len(uploads) > MAX_COUNT:
        raise ValueError('Attach up to 8 screenshots per change')
    from PIL import Image
    total = sum(item['bytes'] for item in existing)
    decoded = []
    for upload in uploads:
        if not isinstance(upload, dict) or not isinstance(upload.get('data'), str):
            raise ValueError('Expected a screenshot data URL')
        header, separator, encoded = upload['data'].partition(',')
        if not separator or header not in {f'data:{mime};base64' for mime, _ in FORMATS.values()}:
            raise ValueError('Screenshots must be PNG, JPEG, or WebP images')
        if len(encoded) > 4 * ((MAX_IMAGE_BYTES + 2) // 3):
            raise ValueError('Each screenshot must be 10 MB or smaller')
        try:
            data = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise ValueError('Invalid screenshot encoding') from error
        total += len(data)
        if len(data) > MAX_IMAGE_BYTES or total > MAX_TOTAL_BYTES:
            raise ValueError('Screenshots must be at most 10 MB each and 20 MB total')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(BytesIO(data)) as picture:
                    if picture.format not in FORMATS or picture.width * picture.height > 40000000:
                        raise ValueError('Use PNG, JPEG, or WebP screenshots up to 40 megapixels')
                    if getattr(picture, 'is_animated', False):
                        raise ValueError('Screenshots must be still images')
                    mime, extension = FORMATS[picture.format]
                    width, height = picture.size
                    picture.verify()
                # Verify pixel data too: some formats defer decoding until load().
                with Image.open(BytesIO(data)) as picture:
                    picture.load()
        except (OSError, SyntaxError, Image.DecompressionBombWarning, Image.DecompressionBombError) as error:
            raise ValueError('Invalid screenshot image') from error
        name = upload.get('name', 'Screenshot')
        if not isinstance(name, str):
            raise ValueError('Screenshot name must be text')
        name = ''.join(c for c in name.replace('\\', '/').split('/')[-1] if c.isprintable())[:180] or 'Screenshot'
        metadata = dict(id=uuid.uuid4().hex[:12], name=name, mime=mime, extension=extension,
                        bytes=len(data), width=width, height=height)
        decoded.append((metadata, data))
    return decoded
