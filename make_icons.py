"""Generate small geometric PWA icons using only the Python standard library."""
from pathlib import Path
import struct
import zlib

def chunk(name, data):
    return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

def icon(size):
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            u,v=x/size,y/size
            color=(73,101,79)
            # A simple notebook in the maskable icon's central safe area.
            if .29<u<.71 and .24<v<.76:
                color=(249,248,241)
            if .34<u<.37 and .24<v<.76:
                color=(174,190,159)
            if .43<u<.65 and any(a<v<a+.024 for a in [.36,.46,.56,.66]):
                color=(113,139,115)
            raw.extend(color)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw)))+chunk(b'IEND',b'')

if __name__=='__main__':
    dest=Path(__file__).resolve().parent/'web'/'icons'
    dest.mkdir(exist_ok=True)
    for n in [192,512]:
        (dest/f'icon-{n}.png').write_bytes(icon(n))
