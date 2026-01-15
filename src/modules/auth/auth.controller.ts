import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.services';
import { RegisterInput, LoginInput } from './auth.types';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input: RegisterInput = req.body;
      const result = await authService.register(input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input: LoginInput = req.body;
      const result = await authService.login(input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}