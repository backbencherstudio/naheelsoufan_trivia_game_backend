import { Module } from '@nestjs/common';
import { GridStyleController } from './grid-style.controller';
import { GridStyleService } from './grid-style.service';

@Module({
  controllers: [GridStyleController],
  providers: [GridStyleService]
})
export class GridStyleModule {}
