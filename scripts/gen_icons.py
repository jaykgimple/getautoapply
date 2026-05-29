#!/usr/bin/env python3
"""Generate simple PNG icons for the Chrome extension."""
import struct
import zlib

def create_png(width, height, color):
    """Create a simple filled rectangle PNG."""
    # Create image data (RGBA)
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter byte
        for x in range(width):
            raw += bytes(color)  # RGBA
    
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
    
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = make_chunk(b'IDAT', zlib.compress(raw))
    iend = make_chunk(b'IEND', b'')
    
    return sig + ihdr + idat + iend

# Brand color: #5e6ad2 (RGB: 94, 106, 210)
color = (94, 106, 210, 255)

sizes = [16, 48, 128]
for size in sizes:
    png = create_png(size, size, color)
    with open(f'extension/icons/icon{size}.png', 'wb') as f:
        f.write(png)
    print(f'Created icon{size}.png ({size}x{size})')
