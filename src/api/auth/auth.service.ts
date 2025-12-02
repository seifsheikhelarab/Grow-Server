import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../../prisma';
import { config } from '../../config/env.config';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
  ErrorCode,
} from '../../utils/response';
import logger from '../../utils/logger';

/**
 * Generate and store OTP
 */
export async function sendOtp(phone: string): Promise<void> {
  try {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiry: 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save to database
    await prisma.otp.upsert({
      where: { phone },
      update: { code, expiresAt },
      create: { phone, code, expiresAt },
    });

    // TODO: Send OTP via SMS in production
    logger.info(`OTP sent to ${phone}: ${code} (DEV MODE - Remove in production)`);
  } catch (err) {
    logger.error(`Error sending OTP: ${err}`);
    throw err;
  }
}

/**
 * Verify OTP and check if user exists
 */
export async function verifyOtp(phone: string, code: string): Promise<{ userExists: boolean; token: string }> {
  try {
    // Find OTP record
    const otpRecord = await prisma.otp.findUnique({ where: { phone } });

    if (!otpRecord) {
      throw new NotFoundError('OTP not found or expired');
    }

    if (otpRecord.expiresAt < new Date()) {
      await prisma.otp.delete({ where: { phone } });
      throw new AuthenticationError('OTP expired', ErrorCode.OTP_EXPIRED);
    }

    if (otpRecord.code !== code) {
      throw new AuthenticationError('Invalid OTP', ErrorCode.INVALID_OTP);
    }

    // Delete used OTP
    await prisma.otp.delete({ where: { phone } });

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // Generate temporary token for registration
      const opts: SignOptions = { expiresIn: '30m' as any };
      const tempToken = jwt.sign(
        { phone, tempAuth: true },
        config.JWT_SECRET as string,
        opts
      );

      logger.info(`OTP verified for new user: ${phone}`);
      return { userExists: false, token: tempToken };
    }

    if (!user.is_active) {
      throw new AuthenticationError('User account is inactive');
    }

    // Generate auth token for existing user
    const opts: SignOptions = { expiresIn: config.JWT_EXPIRY as any };
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      config.JWT_SECRET as string,
      opts
    );

    logger.info(`OTP verified and user authenticated: ${phone}`);
    return { userExists: true, token };
  } catch (err) {
    logger.error(`Error verifying OTP: ${err}`);
    throw err;
  }
}

/**
 * Register new user and create wallet
 */
export async function register(
  phone: string,
  password: string,
  role: 'CUSTOMER' | 'WORKER' | 'OWNER'
): Promise<{ id: string; phone: string; role: string; token: string }> {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      throw new ConflictError('User already exists with this phone number');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user within transaction
    const user = await prisma.user.create({
      data: {
        phone,
        password_hash: passwordHash,
        role,
      },
    });

    // Create wallet
    const wallet = await prisma.wallet.create({
      data: {
        user_id: user.id,
      },
    });

    // Check for shadow wallet (unclaimed points)
    const shadowWallet = await prisma.shadowWallet.findUnique({
      where: { phone },
    });

    if (shadowWallet) {
      // Move shadow wallet balance to real wallet
      await prisma.wallet.update({
        where: { user_id: user.id },
        data: { balance: shadowWallet.balance },
      });

      // Delete shadow wallet
      await prisma.shadowWallet.delete({ where: { phone } });

      logger.info(`Shadow wallet claimed for ${phone}: ${shadowWallet.balance} points`);
    }

    // Generate auth token
    const opts: SignOptions = { expiresIn: config.JWT_EXPIRY as any };
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      config.JWT_SECRET as string,
      opts
    );

    logger.info(`User registered successfully: ${phone} with role ${role}`);
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      token,
    };
  } catch (err) {
    logger.error(`Error registering user: ${err}`);
    throw err;
  }
}

/**
 * Login with phone and password
 */
export async function login(
  phone: string,
  password: string
): Promise<{ id: string; phone: string; role: string; token: string }> {
  try {
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || !user.password_hash) {
      throw new AuthenticationError('Invalid phone or password');
    }

    if (!user.is_active) {
      throw new AuthenticationError('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid phone or password');
    }

    // Generate auth token
    const opts: SignOptions = { expiresIn: config.JWT_EXPIRY as any };
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      config.JWT_SECRET as string,
      opts
    );

    logger.info(`User logged in: ${phone}`);
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      token,
    };
  } catch (err) {
    logger.error(`Error logging in: ${err}`);
    throw err;
  }
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<{
  id: string;
  phone: string;
  role: string;
}> {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      id: string;
      phone: string;
      role: string;
    };
    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired', ErrorCode.TOKEN_EXPIRED);
    }
    throw new AuthenticationError('Invalid token', ErrorCode.INVALID_TOKEN);
  }
}
