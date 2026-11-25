"""只读旧账本，生成独立 SQLite 和可恢复 JSON；绝不覆盖原库。"""
import json
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent

def backup(root=ROOT):
    target = root / 'data' / ('upgrade-backup-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    target.mkdir(parents=True)
    dbpath = root / 'data' / 'expenses.db'
    if dbpath.exists():
        with sqlite3.connect(f'{dbpath.as_uri()}?mode=ro', uri=True) as src, sqlite3.connect(target / 'expenses.db') as dst:
            src.backup(dst)
            src.row_factory = sqlite3.Row
            rows = [dict(row) for row in src.execute('SELECT * FROM expenses ORDER BY date')]
        payload = {'format':'qingji-legacy','version':1,'exported_at':datetime.now().isoformat(),'expenses':rows}
        (target / 'legacy-backup.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    for name in ['web','server.py','README.md','test_server.py','test_receipt_parser.js','test_app_flow.js']:
        source = root / name
        if source.is_dir():
            shutil.copytree(source, target / name)
        elif source.exists():
            shutil.copy2(source, target / name)
    print(f'备份完成：{target}')
    return target

if __name__ == '__main__':
    backup()
