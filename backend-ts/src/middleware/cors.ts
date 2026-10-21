import cors from 'cors';

/**
 * CORS configuration
 */
function getAllowedOrigins(): string[] {
  return [
    'http://localhost:3000',
    'http://localhost:3005',
    ...(process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ];
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header are non-browser calls, so CORS does not apply.
    // Allow them through without emitting CORS headers and keep the browser allowlist
    // enforcement for explicit cross-origin requests.
    if (!origin) {
      return callback(null, true);
    }

    if (getAllowedOrigins().includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);
