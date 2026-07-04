import paramiko
import sys
import tempfile
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

service_file = """[Unit]
Description=Felslager Node.js API
After=network.target

[Service]
ExecStart=/usr/bin/node /home/vorstieg/felslager/index.js
Restart=always
User=vorstieg
Group=vorstieg
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/home/vorstieg/felslager

[Install]
WantedBy=multi-user.target
"""

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    # Kill PM2
    ssh.exec_command('pm2 kill')
    
    fd, temp_path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(service_file)
    
    sftp = ssh.open_sftp()
    sftp.put(temp_path, "/home/vorstieg/felslager.service")
    sftp.close()
    os.remove(temp_path)
    
    commands = [
        f"echo '{PASSWORD}' | sudo -S mv /home/vorstieg/felslager.service /etc/systemd/system/felslager.service",
        f"echo '{PASSWORD}' | sudo -S systemctl daemon-reload",
        f"echo '{PASSWORD}' | sudo -S systemctl enable felslager",
        f"echo '{PASSWORD}' | sudo -S systemctl start felslager"
    ]
    
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdout.channel.recv_exit_status()
        
    ssh.close()
except Exception as e:
    sys.exit(1)
