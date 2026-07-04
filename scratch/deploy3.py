import paramiko
import sys

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    commands = [
        "mv /home/vorstieg/felsverzeichnis_prod /home/vorstieg/felsverzeichnis_prod_old_" + str(sys.argv[1] if len(sys.argv) > 1 else "1"),
        "git clone https://github.com/Vorstieg/Felsverzeichnis.git /home/vorstieg/felsverzeichnis_prod",
        "cd /home/vorstieg/felsverzeichnis_prod && npm install",
        "cd /home/vorstieg/felsverzeichnis_prod && npm run build",
        "pm2 delete felsverzeichnis_prod || true",
        "cd /home/vorstieg/felsverzeichnis_prod && PORT=3000 pm2 start build/index.js --name felsverzeichnis_prod"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
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
