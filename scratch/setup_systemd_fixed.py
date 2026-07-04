import paramiko
import sys
import tempfile
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    stdin, stdout, stderr = ssh.exec_command('which node')
    node_path = stdout.read().decode().strip()
    
    service_file = f"""[Unit]
Description=Felslager Node.js API
After=network.target

[Service]
ExecStart={node_path} /home/vorstieg/felslager/index.js
Restart=always
User=vorstieg
Group=vorstieg
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/home/vorstieg/felslager

[Install]
WantedBy=multi-user.target
"""
    
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
        f"echo '{PASSWORD}' | sudo -S systemctl restart felslager"
    ]
    
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdout.channel.recv_exit_status()
        
    ssh.close()
    print("Systemd fixed")
except Exception as e:
    print(e)
    sys.exit(1)
