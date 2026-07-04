import paramiko
import sys

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    commands = [
        "cd /home/vorstieg/felsverzeichnis_prod && git pull",
        "cd /home/vorstieg/felsverzeichnis_prod && npm install",
        "cd /home/vorstieg/felsverzeichnis_prod && npm run build",
        "pm2 restart felsverzeichnis_prod || pm2 start build/index.js --name felsverzeichnis_prod"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        # Read line by line to prevent blocking forever if there's lots of output
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
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
