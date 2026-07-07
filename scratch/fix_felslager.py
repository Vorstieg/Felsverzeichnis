import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

stdin, stdout, stderr = ssh.exec_command('''
cd /home/vorstieg/felslager
pm2 delete felslager
DATA_DIR=/home/vorstieg/fels-data pm2 start index.js --name felslager
echo "DATA_DIR=/home/vorstieg/fels-data" > .env
echo "API_USER=admin" >> .env
echo "API_PASSWORD=password" >> .env
''')
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

ssh.close()
