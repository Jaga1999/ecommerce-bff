import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T> {
  @ApiProperty()
  data: T | null;

  @ApiProperty()
  timetakenms: number;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  path: string;

  @ApiProperty({ type: 'boolean', nullable: true })
  error: boolean | null;

  @ApiProperty({ nullable: true })
  details: unknown;

  constructor(
    data: T | null,
    timetakenms: number,
    requestId: string,
    path: string,
    error: string[] | boolean | null = null,
    details: unknown = null,
  ) {
    this.data = data;
    this.timetakenms = timetakenms;
    this.requestId = requestId;
    this.path = path;

    if (typeof error === 'boolean') {
      this.error = error;
      this.details = details || null;
    } else if (Array.isArray(error) && error.length > 0) {
      this.error = true;
      // Prioritize details if it's an array with content, otherwise use error messages
      this.details =
        Array.isArray(details) && details.length > 0 ? details : error;
    } else {
      this.error = null;
      this.details =
        details && (Array.isArray(details) ? details.length > 0 : true)
          ? details
          : null;
    }
  }
}
