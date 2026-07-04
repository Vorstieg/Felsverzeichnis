import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

nginx_conf = """server {
    listen 80;
    server_name felslager.vorstieg.eu;

    location / {
        proxy_pass http://10.0.0.2:3001; 
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('147.93.126.130', username='root', password='MaxMotives', timeout=10)
    
    # Write the conf
    sftp = ssh.open_sftp()
    with sftp.open('/etc/nginx/sites-available/felslager.vorstieg.eu', 'w') as f:
        f.write(nginx_conf)
    sftp.close()
    
    commands = [
        "ln -sf /etc/nginx/sites-available/felslager.vorstieg.eu /etc/nginx/sites-enabled/",
        "nginx -t && systemctl reload nginx"
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
