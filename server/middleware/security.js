import helmet from 'helmet';

export const securityHeaders = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
});
