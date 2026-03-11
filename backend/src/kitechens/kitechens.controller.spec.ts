import { Test, TestingModule } from '@nestjs/testing';
import { KitechensController } from './kitechens.controller';
import { KitechensService } from './kitechens.service';

describe('KitechensController', () => {
  let controller: KitechensController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KitechensController],
      providers: [KitechensService],
    }).compile();

    controller = module.get<KitechensController>(KitechensController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
