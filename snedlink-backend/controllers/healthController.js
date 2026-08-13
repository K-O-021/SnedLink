function healthCheck(req, res) {
  res.json({
    status: 'ok',
    service: 'snedlink-backend',
    time: new Date().toISOString()
  });
}

module.exports = { healthCheck };
