import paramiko
import sys
import tempfile
import os

if len(sys.argv) < 2:
    print("Usage: python nginx_setup.py <domain>")
    sys.exit(1)

DOMAIN = sys.argv[1]
HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

nginx_config = f"""
server {{
    listen 80;
    server_name {DOMAIN};

    # Increase max body size for large GLB/Image uploads
    client_max_body_size 500M;

    # Serve static assets directly from the entries folder
    location ~ ^/api/fs/(.*\.(jpg|jpeg|png|gif|glb|pdf))$ {{
        alias /home/vorstieg/fels-data/entries/$1;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        
        # Enable CORS for static files
        add_header Access-Control-Allow-Origin *;
    }}

    # Proxy everything else to the Node API
    location /api/fs/ {{
        proxy_pass http://127.0.0.1:3001/api/fs/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Ensure timeout is generous for uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }}
}}
"""

try:
    print(f"Connecting to remote server to configure Nginx for {DOMAIN}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    # Write config to a temporary local file
    fd, temp_path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(nginx_config)
    
    # Upload config to home directory first
    sftp = ssh.open_sftp()
    sftp.put(temp_path, "/home/vorstieg/fels-api.conf")
    sftp.close()
    os.remove(temp_path)
    
    # Move to nginx sites-available, link, and reload
    # Note: Requires sudo. We use 'echo password | sudo -S' to bypass prompt
    commands = [
        f"echo '{PASSWORD}' | sudo -S mv /home/vorstieg/fels-api.conf /etc/nginx/sites-available/fels-api.conf",
        f"echo '{PASSWORD}' | sudo -S ln -sf /etc/nginx/sites-available/fels-api.conf /etc/nginx/sites-enabled/",
        f"echo '{PASSWORD}' | sudo -S systemctl reload nginx"
    ]
    
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            print(f"Error on command: {cmd}")
            print(stderr.read().decode())
        else:
            print(f"Success: {cmd.split('| sudo')[1]}")
            
    print(f"Nginx successfully configured for {DOMAIN}!")
    ssh.close()

except Exception as e:
    print(f"Failed to configure Nginx: {e}")
    sys.exit(1)
