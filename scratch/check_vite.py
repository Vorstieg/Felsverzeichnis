import urllib.request
import urllib.error

try:
    urllib.request.urlopen('http://localhost:5173/map')
except urllib.error.HTTPError as e:
    print(e.read().decode())
