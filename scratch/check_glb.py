import io
import sys
import paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

stdin, stdout, stderr = ssh.exec_command('curl -s "http://localhost:3001/api/fs/entries/europe/austria/lower-austria/m%C3%B6dling/efeugrat"')
print("STDOUT:", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:", stderr.read().decode('utf-8', errors='ignore'))
# Wait for the command to complete
stdout.channel.recv_exit_status()
ssh.close()
