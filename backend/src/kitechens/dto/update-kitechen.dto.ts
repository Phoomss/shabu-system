import { PartialType } from '@nestjs/swagger';
import { CreateKitchenDto } from './create-kitechen.dto';


export class UpdateKitchenDto extends PartialType(CreateKitchenDto) {}