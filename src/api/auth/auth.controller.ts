import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthenticationError, ErrorCode, ResponseHandler } from '../../utils/response';
import { asyncHandler, errorHandler } from '../../middlewares/error.middleware';

// Send OTP to phone number
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;

  await authService.sendOtp(phone);

  ResponseHandler.success(res, 'OTP sent successfully', {
    message: 'Please check your phone for the OTP',
  });
});

// Verify OTP and authenticate
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, code } = req.body;

  const result = await authService.verifyOtp(phone, code);

  if(!result.userExists || !result.token){
    errorHandler(new AuthenticationError('User does not exist', ErrorCode.INVALID_TOKEN), req, res);
    return;
  }

  
  ResponseHandler.success(res, 'OTP verified successfully', {
    token: result.token,
  });

});

// Register new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { phone, password, role } = req.body;

  const result = await authService.register(phone, password, role);

  ResponseHandler.created(res, 'User registered successfully', {
    id: result.id,
    phone: result.phone,
    role: result.role,
    token: result.token,
  });
});

// Login with phone and password
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { phone, password } = req.body;

  const result = await authService.login(phone, password);

  ResponseHandler.success(res, 'Login successful', {
    id: result.id,
    phone: result.phone,
    role: result.role,
    token: result.token,
  });
});


// Verify authentication status
export const verifyAuth = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return ResponseHandler.success(res, 'Not authenticated', {
      authenticated: false,
    });
  }

  return ResponseHandler.success(res, 'Authenticated', {
    authenticated: true,
    user: req.user,
  });
});
