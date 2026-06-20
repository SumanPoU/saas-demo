import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  InitiateRegisterDto,
  VerifyRegisterOtpDto,
  CompleteRegisterDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordVerifyDto } from './dto/reset-password-verify.dto';
import { ResetPasswordCompleteDto } from './dto/reset-password-complete.dto';
import { OAuthDto } from './dto/oauth.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetRequiredPasswordDto } from './dto/set-required-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ResponseMessage } from '../common/response';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/initiate')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage(
    'Registration initiated. Please check your email for the OTP verification code.',
  )
  @ApiOperation({
    summary:
      'Step 1: Initiate registration, generates a pending user and sends an email verification OTP',
  })
  @ApiResponse({
    status: 201,
    description: 'Verification OTP sent successfully',
    schema: {
      example: {
        statusCode: 201,
        message:
          'Registration initiated. Please check your email for the OTP verification code.',
        data: {
          tempUserId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async registerInitiate(@Body() dto: InitiateRegisterDto) {
    return this.authService.registerInitiate(dto);
  }

  @Public()
  @Post('register/resend-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('New verification OTP sent successfully')
  @ApiOperation({
    summary: 'Step 1.5: Resend a fresh email verification OTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'New verification OTP sent successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'New verification OTP sent successfully',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Public()
  @Post('register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('OTP successfully verified')
  @ApiOperation({ summary: 'Step 2: Verify the registration OTP code' })
  @ApiResponse({
    status: 200,
    description: 'OTP successfully verified',
    schema: {
      example: {
        statusCode: 200,
        message: 'OTP successfully verified',
        data: {
          verificationToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresIn: 3600,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async registerVerifyOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.registerVerifyOtp(dto);
  }

  @Public()
  @Post('register/complete')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Registration complete. You can now login.')
  @ApiOperation({
    summary:
      'Step 3: Complete registration by setting the user password (manual login required after)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Account password configured successfully. User must manually login.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Registration complete. You can now login.',
        data: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Password confirmation mismatch' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired email verification code',
  })
  async registerComplete(@Body() dto: CompleteRegisterDto) {
    return this.authService.registerComplete(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({
    summary: 'Log in with username or email and password',
    description:
      'Returns access and refresh tokens for normal users. If the password is system-generated and must be changed, no auth tokens are issued; the response includes passwordChangeToken and nextStep details for POST /auth/set-required-password.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successful login. Either tokens are returned, or passwordChangeToken is returned when requiresPasswordChange is true.',
    schema: {
      oneOf: [
        {
          example: {
            success: true,
            message: 'Login successful',
            data: {
              tokens: {
                accessToken: 'jwt-access-token',
                refreshToken: 'jwt-refresh-token',
              },
              user: {
                id: 'user-id',
                email: 'user@example.com',
                username: 'user',
                mustChangePassword: false,
                roles: ['User'],
                permissions: [],
              },
              requiresPasswordChange: false,
              message: 'Login successful',
            },
          },
        },
        {
          example: {
            success: true,
            message: 'Login successful',
            data: {
              success: false,
              requiresPasswordChange: true,
              passwordChangeToken: 'short-lived-token',
              nextStep: {
                action: 'SET_PASSWORD',
                method: 'POST',
                endpoint: '/auth/set-required-password',
              },
              message:
                'Temporary password accepted. Set a new password, then log in again with the new password.',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account inactive',
  })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('set-required-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password set successfully. Please login again.')
  @ApiBody({ type: SetRequiredPasswordDto })
  @ApiOperation({
    summary:
      'Set a new password after temporary-password login, then require normal login',
    description:
      'Consumes the short-lived passwordChangeToken returned by login when requiresPasswordChange is true. This endpoint sets the real password, clears mustChangePassword, revokes existing sessions/tokens, and does not issue auth tokens. The user must log in again with the new password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully. User must login again.',
    schema: {
      example: {
        success: true,
        message: 'Password set successfully. Please login again.',
        data: {
          success: true,
          message:
            'Password set successfully. Please log in again with your new password.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Password confirmation mismatch or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired password change token',
  })
  async setRequiredPassword(
    @Body() dto: SetRequiredPasswordDto,
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.setRequiredPassword(dto, ipAddress, userAgent);
  }

  @ApiBearerAuth('JWT')
  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Workspace switched successfully')
  @ApiOperation({
    summary: 'Switch the active tenant context for this session',
  })
  @ApiResponse({
    status: 200,
    description: 'New token pair generated for the requested tenant',
    schema: {
      example: {
        statusCode: 200,
        message: 'Workspace switched successfully',
        data: {
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or not a member of the tenant',
  })
  async switchTenant(
    @Body() dto: import('./dto/switch-tenant.dto').SwitchTenantDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.switchTenant(
      user.id || user.userId,
      user.sessionId,
      dto.tenantId,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tokens successfully refreshed')
  @ApiOperation({ summary: 'Rotate JWT access and refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'New token pair generated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Tokens successfully refreshed',
        data: {
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid/expired token or reuse security violation',
  })
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.refresh(dto, ipAddress, userAgent);
  }

  @ApiBearerAuth('JWT')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Successfully logged out')
  @ApiOperation({ summary: 'Log out from the current active session' })
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
    schema: {
      example: {
        statusCode: 204,
        message: 'Successfully logged out',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser() user: any, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.logout(
      user.sessionId,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password recovery request initiated')
  @ApiOperation({
    summary:
      'Step 1: Request password recovery using username or email address',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP generated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Password recovery request initiated',
        data: {
          verificationId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
        },
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('reset-password/verify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password recovery OTP verified successfully')
  @ApiOperation({ summary: 'Step 2: Verify the password recovery OTP code' })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Password recovery OTP verified successfully',
        data: {
          resetToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresIn: 3600,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async resetPasswordVerify(@Body() dto: ResetPasswordVerifyDto) {
    return this.authService.resetPasswordVerify(dto);
  }

  @Public()
  @Post('reset-password/complete')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully')
  @ApiOperation({
    summary:
      'Step 3: Complete password recovery by setting a new password using recovery identifier and OTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully, existing sessions terminated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Password reset successfully',
        data: {
          userId: 'user-id',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Password confirmation mismatch' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired password reset code',
  })
  async resetPasswordComplete(
    @Body() dto: ResetPasswordCompleteDto,
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.resetPasswordComplete(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Google login successful')
  @ApiOperation({
    summary:
      'Authenticate a user via Google Single Sign-On (SSO) code token exchange',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful, login session tokens returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Google login successful',
        data: {
          tokens: {
            accessToken: 'jwt-access-token',
            refreshToken: 'jwt-refresh-token',
          },
          user: {
            id: 'user-id',
            email: 'user@google.com',
            username: 'google-user',
            roles: ['User'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Google authorization code or exchange failure',
  })
  async googleLogin(@Body() dto: OAuthDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.googleLogin(
      dto.code,
      dto.state,
      dto.expectedState,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('oauth/github')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('GitHub login successful')
  @ApiOperation({
    summary:
      'Authenticate a user via GitHub Single Sign-On (SSO) code token exchange',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful, login session tokens returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'GitHub login successful',
        data: {
          tokens: {
            accessToken: 'jwt-access-token',
            refreshToken: 'jwt-refresh-token',
          },
          user: {
            id: 'user-id',
            email: 'user@github.com',
            username: 'github-user',
            roles: ['User'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid GitHub authorization code or exchange failure',
  })
  async githubLogin(@Body() dto: OAuthDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.authService.githubLogin(
      dto.code,
      dto.state,
      dto.expectedState,
      ipAddress,
      userAgent,
    );
  }

  @ApiBearerAuth('JWT')
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User profile retrieved successfully')
  @ApiOperation({
    summary: 'Get the profile information of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'User profile retrieved successfully',
        data: {
          id: 'user-id',
          email: 'user@example.com',
          username: 'user',
          isActive: true,
          roles: ['User'],
          permissions: [],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @ApiBearerAuth('JWT')
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed successfully')
  @ApiOperation({
    summary: 'Change the password for the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password changed successfully, current session remains active',
    schema: {
      example: {
        statusCode: 200,
        message: 'Password changed successfully',
        data: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Password confirmation mismatch' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or current password incorrect',
  })
  async changePassword(
    @CurrentUser() user: any,
    @Req() req: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, user.sessionId, dto);
  }
}
