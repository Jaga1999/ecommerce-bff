import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger: Logger;
  constructor(private readonly appService: AppService) {
    this.logger = new Logger(AppController.name);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
