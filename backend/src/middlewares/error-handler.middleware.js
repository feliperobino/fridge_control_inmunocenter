export function errorHandlerMiddleware(error, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const isProduction = process.env.NODE_ENV === 'production';

  if (res.headersSent) {
    return next(error);
  }

  // eslint-disable-next-line no-console
  if (!isProduction) {
    console.error(error);
  }

  return res.status(error.status || 500).json({
    error: isProduction ? 'Internal Server Error' : error.message || 'Internal Server Error'
  });
}