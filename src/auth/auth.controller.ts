import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  Logger,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppProperties } from '../config/properties/app.properties';
import { SessionProperties } from '../config/properties/session.properties';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { AuthResult, LoginResponse } from './interfaces/auth.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger: Logger;
  constructor(
    private readonly authService: AuthService,
    private readonly appProps: AppProperties,
    private readonly sessionProps: SessionProperties,
  ) {
    this.logger = new Logger(AuthController.name);
  }
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    this.logger.log(`Login attempt for user: ${loginDto.username}`);
    const result: AuthResult = await this.authService.login(loginDto);
    this.setSessionCookie(response, result.sessionId, !!loginDto.rememberMe);
    this.logger.debug(`Login successful for user: ${loginDto.username}`);
    return { message: 'logged in successfully', user: result.user };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // Added HttpCode
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Register attempt for user: ${registerDto.username}`);
    const result = await this.authService.register(registerDto);
    this.logger.log(`Register successful for user: ${registerDto.username}`);
    return result;
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  google(@Res() response: Response): void {
    this.logger.log('Initiating Google OAuth login');
    const result = this.authService.googleLogin();
    this.logger.debug(`Redirecting to Google login URL: ${result.url}`);
    response.redirect(result.url);
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback handler' })
  async callback(
    @Query('code') code: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `OAuth callback received with code: ${code.substring(0, 5)}...`,
      );
      const result: AuthResult = await this.authService.handleCallback(code);
      this.setSessionCookie(response, result.sessionId, false);
      const frontendUrl = this.appProps.frontendUrl;
      this.logger.debug(`Redirecting to frontend: ${frontendUrl}`);
      response.redirect(frontendUrl);
    } catch (error: unknown) {
      this.logger.error(
        `OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Get('me')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved' })
  me(@CurrentUser() user: AuthResult['user']): AuthResult['user'] {
    return user;
  }

  @Patch('me')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: AuthResult['user'],
    @Body() updateDto: UpdateProfileDto,
  ): Promise<{ message: string; user: AuthResult['user'] }> {
    return this.authService.updateProfile(user.id, updateDto);
  }

  @Post('admin/users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create user with specific role (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  async createAdminUser(
    @Body() registerDto: RegisterDto,
    @Query('role') role: Role = Role.USER,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Admin creating user: ${registerDto.username} with role: ${role}`,
    );
    const result = await this.authService.createUser(registerDto, role);
    this.logger.log(`Admin created user successfully: ${registerDto.username}`);
    return result;
  }

  @Patch('admin/users/:id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ): Promise<{ message: string }> {
    this.logger.log(`Admin updating role for user ID ${id} to: ${role}`);
    const result = await this.authService.updateUserRole(id, role);
    this.logger.log(`Admin updated role successfully for user ID ${id}`);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and clear session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookieName = this.sessionProps.cookieName;
    const sessionId = (req.cookies as Record<string, string>)[cookieName];
    if (sessionId) {
      this.logger.log(`Logging out session: ${sessionId}`);
      await this.authService.logout(sessionId);
      response.clearCookie(cookieName);
    }
  }

  private setSessionCookie(
    response: Response,
    sessionId: string,
    rememberMe?: boolean,
  ): void {
    const cookieName = this.sessionProps.cookieName;
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 3600000; // 30 days or 1 hour

    this.logger.debug(`Setting session cookie: ${cookieName}`);

    response.cookie(cookieName, sessionId, {
      httpOnly: true,
      secure: this.appProps.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: maxAge,
    });
  }
}
