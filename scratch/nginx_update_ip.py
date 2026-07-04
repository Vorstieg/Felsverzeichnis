import paramiko
import sys
import tempfile
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

nginx_config = """
server {
    listen 80 default_server;
    server_name felslager.vorstieg.eu 100.85.95.46;

    client_max_body_size 500M;

    location ~ ^/api/fs/(.*\.(jpg|jpeg|png|gif|glb|pdf))$ {
        alias /home/vorstieg/fels-data/entries/$1;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        add_header Access-Control-Allow-Origin *;
    }

    location /api/fs/ {
        proxy_pass http://127.0.0.1:3001/api/fs/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
"""

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    fd, temp_path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(nginx_config)
    
    sftp = ssh.open_sftp()
    sftp.put(temp_path, "/home/vorstieg/fels-api.conf")
    sftp.close()
    os.remove(temp_path)
    
    commands = [
        f"echo '{PASSWORD}' | sudo -S mv /home/vorstieg/fels-api.conf /etc/nginx/sites-available/fels-api.conf",
        f"echo '{PASSWORD}' | sudo -S systemctl reload nginx"
    ]
    
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdout.channel.recv_exit_status()
        
    ssh.close()
except Exception as e:
    sys.exit(1)
