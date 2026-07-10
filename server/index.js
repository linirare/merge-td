const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 静态文件服务（所有文件在仓库根目录）
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: 0,
  etag: false,
  lastModified: false,
}));

const { attachPvp } = require('./pvp-server');
attachPvp(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] 水果突击运行在端口 ${PORT}`);
});
