import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MfaService } from './mfa.service';
import {
  VerifyMfaSetupDto,
  VerifyMfaLoginDto,
  DisableMfaDto,
  RecoverMfaDto,
  RegenerateBackupDto,
  VerifyDeviceDto,
} from './dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/response';
import { AUTH_SENSITIVE_THROTTLE } from '../auth/auth-throttle.constants';

@ApiTags('Multi-Factor Authentication')
@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @ApiBearerAuth('JWT')
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('MFA setup initiated successfully')
  @ApiOperation({
    summary: 'Step 1: Initiate MFA setup, generates a TOTP secret and QR code',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA setup details successfully generated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setup(@CurrentUser() user: any) {
    return this.mfaService.setup(user.id);
  }

  @ApiBearerAuth('JWT')
  @Post('verify-setup')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('MFA successfully enabled')
  @ApiOperation({
    summary:
      'Step 2: Verify code from authenticator app, enables MFA and returns backup codes',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA successfully enabled, backup codes returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
  })
  async verifySetup(@CurrentUser() user: any, @Body() dto: VerifyMfaSetupDto) {
    return this.mfaService.verifySetup(user.id, dto.code);
  }

  @ApiBearerAuth('JWT')
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Backup codes successfully regenerated')
  @ApiOperation({
    summary: 'Regenerate backup codes, revokes existing backup codes',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup codes successfully regenerated',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired confirmation TOTP code',
  })
  async regenerateBackupCodes(
    @CurrentUser() user: any,
    @Body() dto: RegenerateBackupDto,
  ) {
    return this.mfaService.regenerateBackupCodes(user.id, dto.code);
  }

  @Public()
  @Throttle(AUTH_SENSITIVE_THROTTLE)
  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('MFA login successful')
  @ApiOperation({
    summary: 'Complete login using a TOTP code or a single-use backup code',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA verification successful, login session tokens returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid pending token, incorrect code, or account inactive',
  })
  async verifyLogin(@Body() dto: VerifyMfaLoginDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'];
    return this.mfaService.verifyLogin(
      dto.mfaPendingToken,
      dto.code,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Throttle(AUTH_SENSITIVE_THROTTLE)
  @Post('verify-device')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device verified successfully')
  @ApiOperation({ summary: 'Verify and authorize a new login device' })
  @ApiResponse({
    status: 200,
    description: 'New device successfully authorized',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired device token link',
  })
  async verifyDevice(@Body() dto: VerifyDeviceDto) {
    return this.mfaService.verifyDevice(dto.token);
  }

  @ApiBearerAuth('JWT')
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('MFA deactivated successfully')
  @ApiOperation({ summary: 'Disable MFA on the account' })
  @ApiResponse({ status: 200, description: 'MFA successfully deactivated' })
  @ApiResponse({ status: 400, description: 'MFA is not active' })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code confirmation',
  })
  async disable(@CurrentUser() user: any, @Body() dto: DisableMfaDto) {
    return this.mfaService.disable(user.id, dto.code);
  }

  @Public()
  @Throttle(AUTH_SENSITIVE_THROTTLE)
  @Post('recover')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('MFA recovery request initiated')
  @ApiOperation({
    summary:
      'Step 1: Initiate MFA account recovery, dispatches recovery link to email',
  })
  @ApiResponse({ status: 200, description: 'Recovery request initiated' })
  async recover(@Body() dto: RecoverMfaDto) {
    return this.mfaService.recover(dto.email);
  }

  @Public()
  @Throttle(AUTH_SENSITIVE_THROTTLE)
  @Post('recover/verify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Account successfully recovered and MFA disabled')
  @ApiOperation({
    summary:
      'Step 2: Complete account recovery using email recovery token to disable MFA',
  })
  @ApiResponse({
    status: 200,
    description: 'Account successfully recovered, MFA deactivated',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired recovery link token',
  })
  async verifyRecovery(@Body() dto: VerifyDeviceDto) {
    return this.mfaService.verifyRecovery(dto.token);
  }
}
