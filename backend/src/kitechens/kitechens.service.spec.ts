import { Test, TestingModule } from '@nestjs/testing';
import { KitechensService } from './kitechens.service';

describe('KitechensService', () => {
  let service: KitechensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KitechensService],
    }).compile();

    service = module.get<KitechensService>(KitechensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
