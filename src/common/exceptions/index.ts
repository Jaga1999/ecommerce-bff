import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthenticationFailedException extends HttpException {
  constructor(message: string = 'Authentication failed', details: any[] = []) {
    super({ message, details }, HttpStatus.UNAUTHORIZED);
  }
}

export class UserConflictException extends HttpException {
  constructor(message: string = 'User already exists', details: any[] = []) {
    super({ message, details }, HttpStatus.CONFLICT);
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id: string) {
    super(
      { message: `${resource} with ID ${id} not found` },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AccessDeniedException extends HttpException {
  constructor(message: string = 'Access denied') {
    super({ message }, HttpStatus.FORBIDDEN);
  }
}
