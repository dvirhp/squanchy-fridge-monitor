import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportDto } from './import.dto';
import { ImportsService } from './imports.service';
import { MAX_FILE_BYTES } from './csv-parser';

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 8, fieldSize: 1024 } }))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  importFile(@UploadedFile() file: Express.Multer.File | undefined, @Body() metadata: ImportDto) {
    if (!file) throw new BadRequestException('A CSV file is required in the file field.');
    return this.imports.importCsv(file.buffer, file.originalname, metadata);
  }
}
