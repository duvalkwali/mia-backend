import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '@/config/database';
import { env } from '@/config/env';
import { AppError } from '@/middleware/errorHandler';
import { RegisterInput, LoginInput, AuthResponse } from './auth.types';
import logger from '../../config/logger';

/**
 * ============================
 * AUTH SERVICE
 * ============================
 *
 * This service contains ALL business logic related to authentication.
 *
 * Responsibilities:
 * - User registration
 * - User login
 * - Password hashing & verification
 * - JWT generation & verification
 * - Tenant creation (multi-tenant architecture)
 *
 * IMPORTANT:
 * - This file DOES NOT handle HTTP requests
 * - This file DOES NOT send HTTP responses
 * - This file CAN throw errors (AppError)
 */
export class AuthService {
  // Secret key used to sign and verify JWT tokens — validated at boot in env.ts
  private readonly JWT_SECRET = env.jwt.secret;

  // How long JWT tokens remain valid
  private readonly JWT_EXPIRY = env.jwt.expiry;

  // Number of salt rounds used by bcrypt when hashing passwords
  private readonly SALT_ROUNDS = 10;

  /**
   * Register a new user and create a new tenant
   */
  async register(input: RegisterInput): Promise<AuthResponse> {

    // 1️⃣ Check if a user with the same email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError(409, 'USER_EXISTS', 'User already exists');
    }

    // 2️⃣ Hash the user's password before storing it
    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    /**
     * 3️⃣ Create tenant and user in a SINGLE database transaction
     * This ensures:
     * - Either both tenant and user are created
     * - Or nothing is created (no partial data)
     */
    const result = await prisma.$transaction(async (tx) => {

      // Create tenant (business)
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          email: input.email,
          status: 'TRIAL',
        },
      });

      // Create user linked to the tenant
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

    // Log successful registration event
    logger.info('User registered', {
      userId: result.user.id,
      tenantId: result.tenant.id,
    });

    // 4️⃣ Generate JWT token for the new user
    const token = this.generateToken(
      result.user.id,
      result.tenant.id,
      'OWNER'
    );

    // 5️⃣ Return authentication response
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

  /**
   * Authenticate an existing user
   */
  async login(input: LoginInput): Promise<AuthResponse> {

    // 1️⃣ Find user by email and load tenant info
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    // 2️⃣ Compare provided password with stored hash
    const isValidPassword = await bcrypt.compare(
      input.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    // 3️⃣ Check tenant account status
    if (user.tenant.status === 'SUSPENDED') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
    }

    // Log successful login event
    logger.info('User logged in', {
      userId: user.id,
      tenantId: user.tenantId,
    });

    // 4️⃣ Generate JWT token
    const token = this.generateToken(
      user.id,
      user.tenantId,
      user.role
    );

    // 5️⃣ Return authentication response
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

  /**
   * Generate a signed JWT token
   */
  private generateToken(
    userId: string,
    tenantId: string,
    role: string
  ): string {
    return jwt.sign(
      { userId, tenantId, role },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRY } as jwt.SignOptions
    );
  }

  /**
   * Verify a JWT token and extract its payload
   */
  verifyToken(
    token: string
  ): { userId: string; tenantId: string; role: string } {
    try {
      return jwt.verify(token, this.JWT_SECRET) as any;
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
  }
}
