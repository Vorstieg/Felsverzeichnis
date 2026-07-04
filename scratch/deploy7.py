import os
import subprocess
import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def run_local(cmd):
    print(f"Running locally: {cmd}")
    subprocess.run(cmd, shell=True, check=True)

try:
    run_local("git add src/")
    run_local('git commit -m "Fix SSR hanging by using local API URL"')
    run_local("git push origin main")
except subprocess.CalledProcessError as e:
    print(f"Git command failed (might be nothing to commit): {e}")

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    commands = [
        "cd /home/vorstieg/felsverzeichnis_prod && git pull origin main",
        "cd /home/vorstieg/felsverzeichnis_prod && npm install",
        "cd /home/vorstieg/felsverzeichnis_prod && npm run build",
        "pm2 restart felsverzeichnis_prod",
        "pm2 restart felslager || pm2 start /home/vorstieg/felslager/index.js --name felslager"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        if out:
            print(out)
        if err:
            print("ERROR:", err)
        if exit_status != 0:
            print(f"Command failed with status {exit_status}")
            
    ssh.close()
except Exception as e:
    print(f"Failed to connect or execute: {e}")
    sys.exit(1)
