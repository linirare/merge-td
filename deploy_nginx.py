import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('8.138.12.74', username='root', password='Ln13525184251', timeout=10)

sftp = client.open_sftp()

# Write nginx config
nginx = """server {
    listen 80;
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
"""

with sftp.open('/etc/nginx/sites-available/merge-td', 'w') as f:
    f.write(nginx)
sftp.close()

stdin, stdout, stderr = client.exec_command('ln -sf /etc/nginx/sites-available/merge-td /etc/nginx/sites-enabled/default && nginx -t 2>&1', timeout=10)
print('TEST:', stdout.read().decode()[:300])
print('ERR:', stderr.read().decode()[:300])

stdin, stdout, stderr = client.exec_command('systemctl reload nginx 2>&1 && echo NGINX_OK', timeout=10)
print('RELOAD:', stdout.read().decode()[:200])

client.close()
print('DONE')
