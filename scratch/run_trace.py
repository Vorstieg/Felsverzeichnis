import paramiko
import sys
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    # Run node with cpu-prof
    commands = [
        "cd /home/vorstieg/felsverzeichnis_prod && rm -f CPU*.cpuprofile",
        "cd /home/vorstieg/felsverzeichnis_prod && HOST=0.0.0.0 PORT=3000 node --cpu-prof build/index.js & NODE_PID=$!; sleep 3; curl -v -m 5 http://127.0.0.1:3000/; kill -INT $NODE_PID; wait $NODE_PID",
        "ls -la /home/vorstieg/felsverzeichnis_prod/*.cpuprofile",
        "cat /home/vorstieg/felsverzeichnis_prod/*.cpuprofile | grep -o '\"functionName\":\"[^\"]*\"' | sort | uniq -c | sort -nr | head -n 30"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        if out:
            print("OUT:", out)
        if err:
            print("ERR:", err)
        
    ssh.close()
except Exception as e:
    print(f"Failed: {e}")
    sys.exit(1)
