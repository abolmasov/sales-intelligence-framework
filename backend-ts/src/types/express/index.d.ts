import 'express';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      accessToken: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
