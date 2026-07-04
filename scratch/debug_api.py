import paramiko
import sys
import time

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

sed_cmd = "sed -i 's/const result = await getFiles(targetPath);/console.log(\"DEBUG:\", targetPath); const result = await getFiles(targetPath); console.log(\"FILES:\", result);/' /home/vorstieg/felslager/index.js"
ssh.exec_command(sed_cmd)
ssh.exec_command("killall node")

time.sleep(1)
ssh.exec_command("cd /home/vorstieg/felslager && nohup /usr/bin/node index.js > /home/vorstieg/felslager/app.log 2>&1 &")

time.sleep(2)
ssh.exec_command("curl -s http://127.0.0.1:3001/api/fs/")
time.sleep(1)

stdin, stdout, stderr = ssh.exec_command("cat /home/vorstieg/felslager/app.log")
print(stdout.read().decode('utf-8', 'ignore'))
ssh.close()
