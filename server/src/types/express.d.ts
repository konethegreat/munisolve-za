declare global {
  namespace Express {
    interface Request {
      id: string;
      validated: {
        body?: any;
        query?: any;
        params?: any;
      };
      user?: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        isActive: boolean;
      };
    }
  }
}

export {};
