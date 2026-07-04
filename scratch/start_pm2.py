import paramiko
import sys
import time

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

commands = [
    "echo '{PASSWORD}' | sudo -S npm install -g pm2",
    "cd /home/vorstieg/felslager && pm2 delete felslager || true",
    "cd /home/vorstieg/felslager && pm2 start index.js --name felslager",
    "pm2 save"
]

for cmd in commands:
    cmd_fmt = cmd.format(PASSWORD=PASSWORD)
    stdin, stdout, stderr = ssh.exec_command(cmd_fmt)
    print(stdout.read().decode())
    print(stderr.read().decode())

ssh.close()
