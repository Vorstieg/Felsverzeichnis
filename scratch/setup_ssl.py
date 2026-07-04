import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    commands = [
        "sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx",
        "sudo certbot --nginx -d felsverzeichnis.vorstieg.eu --non-interactive --agree-tos -m robin@vorstieg.eu"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
        # Pass sudo password just in case
        stdin.write('V0rst!eg\n')
        stdin.flush()
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        
        if out:
            print(out)
        if exit_status != 0:
            print(f"Command failed with status {exit_status}")
            
    ssh.close()
except Exception as e:
    print(f"Failed to connect or execute: {e}")
    sys.exit(1)
