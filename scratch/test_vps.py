import sys
import io
import urllib.request
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    req = urllib.request.Request('http://147.93.126.130/', headers={'Host': 'felsverzeichnis.vorstieg.eu'})
    with urllib.request.urlopen(req, timeout=5) as response:
        html = response.read().decode('utf-8')
        print(f"Status: {response.status}")
        print(html[:200])
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode('utf-8', errors='ignore')[:200])
except Exception as e:
    print(f"Failed: {e}")
