const sendResponse = (req, res) => {
  const { statusCode, data, message = 'Success' } = req;

  return res.status(statusCode).json({
    data,
    message,
  });
};

module.exports = {
  sendResponse,
};
