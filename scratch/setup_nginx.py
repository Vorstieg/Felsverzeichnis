import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg', timeout=10)
    
    nginx_conf = """
server {
    listen 80;
    server_name felsverzeichnis.vorstieg.eu;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
"""
    
    commands = [
        f"echo '{nginx_conf}' | sudo tee /etc/nginx/sites-available/felsverzeichnis.conf",
        "sudo ln -sf /etc/nginx/sites-available/felsverzeichnis.conf /etc/nginx/sites-enabled/",
        "sudo systemctl restart nginx"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
        # pass sudo password
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
