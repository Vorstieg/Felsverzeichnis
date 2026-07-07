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

script = """
find /home/vorstieg/fels-data/entries -name "*-low.glb" -delete

# Restore efeugrat
mv /tmp/efeugrat.glb /home/vorstieg/fels-data/entries/europe/austria/lower-austria/mödling/efeugrat/efeugrat.glb

# Restore däumling
mv /tmp/däumling.glb /home/vorstieg/fels-data/entries/europe/austria/lower-austria/wachau/däumling/däumling.glb

# Restore glocknergrat
mv /tmp/glocknergrat.glb /home/vorstieg/fels-data/entries/europe/austria/lower-austria/mödling/glocknergrat/glocknergrat.glb

# Restore obere-lausbubenwand
mv /tmp/obere-lausbubenwand.glb /home/vorstieg/fels-data/entries/europe/austria/lower-austria/mödling/obere-lausbubenwand/obere-lausbubenwand.glb

# Restore untere-lausbubenwand
mv /tmp/untere-lausbubenwand.glb /home/vorstieg/fels-data/entries/europe/austria/lower-austria/mödling/untere-lausbubenwand/untere-lausbubenwand.glb
"""

stdin, stdout, stderr = ssh.exec_command(script)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

ssh.close()
