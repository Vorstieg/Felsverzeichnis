import paramiko
import sys

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    commands = [
        "ls -la /home/vorstieg/",
        "ls -la /var/www/"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
        if out:
            print(out)
        if err:
            print("ERROR:", err)
            
    ssh.close()
except Exception as e:
    print(f"Failed to connect or execute: {e}")
    sys.exit(1)
