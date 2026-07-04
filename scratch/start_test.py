import subprocess
import time
import urllib.request
import urllib.error

print("Starting dev server...")
p = subprocess.Popen(["npm.cmd", "run", "dev"])
time.sleep(15)

try:
    print("Testing /map...")
    res = urllib.request.urlopen("http://localhost:5173/map")
    print("Success:", res.getcode())
except urllib.error.HTTPError as e:
    print("Error:", e.code)
    print(e.read().decode())
finally:
    p.terminate()
