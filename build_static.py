"""Allowlist-based static packaging. Never publish data/, SQLite, or Python APIs."""
import json
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent
FILES=['index.html','mobile.css','icon.svg','manifest.webmanifest','sw.js','receipt-parser.js']
def build():
    dest=ROOT/'dist'
    if dest.exists():
        # Only remove this explicitly resolved generated output directory.
        assert dest.resolve()==ROOT.resolve()/'dist'
        shutil.rmtree(dest)
    dest.mkdir()
    for name in FILES:
        shutil.copy2(ROOT/'web'/name,dest/name)
    for directory in ['js','icons','vendor']:
        if (ROOT/'web'/directory).exists():
            shutil.copytree(ROOT/'web'/directory,dest/directory)
    (dest/'.nojekyll').write_text('')
    manifest=json.loads((dest/'manifest.webmanifest').read_text(encoding='utf-8'))
    assert manifest['start_url'].startswith('./')
    assert not list(dest.rglob('*.db'))
    print('Static site packaged into dist/ (no personal data).')
if __name__=='__main__':build()
