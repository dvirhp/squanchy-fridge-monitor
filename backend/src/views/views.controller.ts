import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { HistoryQueryDto } from './history-query.dto';
import { ViewsService } from './views.service';

@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class ViewsController {
  constructor(private readonly views: ViewsService) {}
  @Get('import-options') options() { return this.views.options(); }
  @Get('dashboard') dashboard(@Query() query: HistoryQueryDto) { return this.views.dashboard(query); }
  @Get('fridges/:id') fridge(@Param('id') id: string, @Query() query: HistoryQueryDto) { return this.views.fridge(id, query); }
}
