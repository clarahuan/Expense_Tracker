import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import server


class LedgerTest(unittest.TestCase):
    def test_persistence_validation_and_delete(self):
        original = server.DB
        with tempfile.TemporaryDirectory() as folder:
            server.DB = Path(folder) / 'test.db'
            server.initialize()
            http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
            thread = threading.Thread(target=http.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{http.server_port}'
            def request(path, payload=None, method='GET'):
                body = json.dumps(payload).encode() if payload is not None else None
                with urlopen(Request(base + path, data=body, method=method, headers={'Content-Type':'application/json'})) as response:
                    return json.load(response)
            try:
                row = {'cents':3850,'category':'餐饮','date':'2026-10-23T12:30','merchant':'测试餐厅','note':'测试'}
                entry = request('/api/expenses', row, 'POST')
                saved = request('/api/expenses')
                self.assertEqual(saved[0]['cents'],3850)
                self.assertEqual(saved[0]['merchant'],'测试餐厅')
                with server.connect() as db:
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM expenses').fetchone()[0],1)
                for changes in ({'cents':-1},{'cents':1.5},{'category':'无效'},{'date':'错误'}):
                    with self.assertRaises(HTTPError) as error:
                        request('/api/expenses',row | changes,'POST')
                    self.assertEqual(error.exception.code,400)
                request('/api/expenses/'+entry['id'],method='DELETE')
                self.assertEqual(request('/api/expenses'),[])
                with urlopen(base) as response:
                    self.assertEqual(response.status,200)
            finally:
                http.shutdown()
                http.server_close()
                server.DB = original

if __name__ == '__main__':
    unittest.main()
