import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { RegisterInput, LoginInput, AuthResponse } from './auth.types';
import logger from '../../config/logger';

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET as string;
  private readonly JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
  private readonly SALT_ROUNDS = 10;

  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError(409, 'USER_EXISTS', 'User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    // Create tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          email: input.email,
          status: 'TRIAL',
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          role: 'OWNER',
        },
      });

      return { tenant, user };
    });

    logger.info('User registered', {
      userId: result.user.id,
      tenantId: result.tenant.id,
    });

    // Generate JWT
    const token = this.generateToken(result.user.id, result.tenant.id, 'OWNER');

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        tenantId: result.tenant.id,
        role: result.user.role,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      input.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    // Check tenant status
    if (user.tenant.status === 'SUSPENDED') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
    }

    logger.info('User logged in', {
      userId: user.id,
      tenantId: user.tenantId,
    });

    // Generate JWT
    const token = this.generateToken(user.id, user.tenantId, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    };
  }

  private generateToken(
    userId: string,
    tenantId: string,
    role: string
  ): string {
    return jwt.sign({ userId, tenantId, role }, this.JWT_SECRET as any, {
      expiresIn: '7d',
    });
  }

  verifyToken(token: string): { userId: string; tenantId: string; role: string } {
    try {
      return jwt.verify(token, this.JWT_SECRET) as any;
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
  }
}
