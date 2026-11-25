"""轻记：仅使用 Python 标准库的局域网记账服务。"""
import json
import sqlite3
import uuid
import socket
import hashlib
from contextlib import contextmanager
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'data' / 'expenses.db'
CATEGORIES = ['餐饮', '购物', '交通', '居住', '娱乐', '健康', '学习', '其他']

@contextmanager
def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize():
    DB.parent.mkdir(exist_ok=True)
    with connect() as db:
        db.execute('CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, cents INTEGER NOT NULL, category TEXT NOT NULL, date TEXT NOT NULL, merchant TEXT NOT NULL, note TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL)')

def validate_item(item):
    if not isinstance(item, dict):
        raise ValueError('账单格式错误')
    cents = item.get('cents')
    if type(cents) is not int or not 0 < cents <= 10000000000:
        raise ValueError('金额必须大于零，最多一亿元')
    if item.get('category') not in CATEGORIES:
        raise ValueError('请选择分类')
    date = item.get('date')
    if not isinstance(date, str) or len(date) != 16:
        raise ValueError('请填写完整时间')
    datetime.strptime(date, '%Y-%m-%dT%H:%M')
    merchant, note = item.get('merchant', ''), item.get('note', '')
    if not isinstance(merchant, str) or not isinstance(note, str) or len(merchant) > 100 or len(note) > 500:
        raise ValueError('商户或备注格式错误或过长')
    return (cents, item['category'], date, merchant.strip(), note.strip())

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def reply(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/expenses':
            with connect() as db:
                self.reply([dict(row) for row in db.execute('SELECT * FROM expenses ORDER BY date DESC, rowid DESC')])
        elif self.path.startswith('/api/'):
            self.reply({'error': '接口不存在'}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path not in ('/api/expenses', '/api/expenses/batch'):
            return self.reply({'error': '接口不存在'}, 404)
        # JSON-only requests also prevent cross-origin HTML form submissions.
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.reply({'error': '请求格式错误'}, 415)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= (524288 if self.path.endswith('/batch') else 16384):
                raise ValueError('请求过大')
            item = json.loads(self.rfile.read(length))
            if self.path.endswith('/batch'):
                return self.import_batch(item)
            values = validate_item(item)
            entry_id = str(uuid.uuid4())
            with connect() as db:
                db.execute('INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?)', (entry_id, *values))
            self.reply({'id': entry_id}, 201)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self.reply({'error': '保存失败，请检查金额、分类和时间'}, 400)

    def import_batch(self, payload):
        if not isinstance(payload, dict) or not isinstance(payload.get('items'), list) or not 1 <= len(payload['items']) <= 200:
            raise ValueError('每批需包含 1 至 200 笔账单')
        import_id = payload.get('import_id')
        if not isinstance(import_id, str) or not 1 <= len(import_id) <= 80:
            raise ValueError('缺少导入编号')
        # Validate every row before opening the transaction: no partial writes.
        values = sorted([validate_item(row) for row in payload['items']], key=lambda row: row[2])
        digest = hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute('SELECT digest, result FROM imports WHERE id = ?', (import_id,)).fetchone()
            if prior:
                if prior['digest'] != digest:
                    raise ValueError('导入编号已用于其他账单')
                result = json.loads(prior['result'])
            else:
                result = {'imported': 0, 'skipped': 0, 'total_cents': 0}
                for row in values:
                    cents, category, date, merchant, note = row
                    exists = db.execute('SELECT 1 FROM expenses WHERE cents = ? AND date = ? AND merchant = ?', (cents, date, merchant)).fetchone()
                    if exists:
                        result['skipped'] += 1
                        continue
                    db.execute('INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?)', (str(uuid.uuid4()), *row))
                    result['imported'] += 1
                    result['total_cents'] += cents
                db.execute('INSERT INTO imports VALUES (?, ?, ?)', (import_id, digest, json.dumps(result)))
        self.reply(result, 201)

    def do_DELETE(self):
        if not self.path.startswith('/api/expenses/'):
            return self.reply({'error': '接口不存在'}, 404)
        with connect() as db:
            cursor = db.execute('DELETE FROM expenses WHERE id = ?', (self.path.rsplit('/', 1)[-1],))
        self.reply({'deleted': cursor.rowcount})

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--host', default='127.0.0.1', help='本地预览默认仅允许本机访问')
    args = parser.parse_args()
    initialize()
    print(f'电脑访问：http://localhost:{args.port}', flush=True)
    if args.host == '0.0.0.0':
        for ip in sorted(set(socket.gethostbyname_ex(socket.gethostname())[2])):
            if not ip.startswith('127.'):
                print(f'iPhone 同一 Wi-Fi 访问：http://{ip}:{args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
