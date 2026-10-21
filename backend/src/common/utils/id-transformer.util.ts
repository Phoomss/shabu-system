import { BadRequestException, Injectable } from '@nestjs/common';

export enum IdPrefix {
  INVOICE = 'inv',
  SESSION = 'ses',
  ORDER = 'ord',
  TABLE = 'tbl',
  USER = 'usr',
  TIER = 'tier',
  MENU_ITEM = 'menu',
  CATEGORY = 'cat',
  KITCHEN = 'kit',
  INGREDIENT = 'ing',
  ORDER_ITEM = 'oi',
}

/** Serialization only: prefixes/display numbers never grant access. */
@Injectable()
export class IdTransformer {
  encode(uuid: string, prefix: IdPrefix): string {
    return `${prefix}_${this.decode(uuid, prefix).replace(/-/g, '')}`;
  }

  encodeInt(id: number, prefix: IdPrefix): string {
    return `${prefix}_${this.decodeInt(id, prefix).toString().padStart(6, '0')}`;
  }

  /** Accept the legacy raw UUID or an explicitly typed prefixed UUID. */
  decode(value: string, expectedPrefix?: IdPrefix): string {
    if (typeof value !== 'string')
      throw new BadRequestException('Invalid UUID ID');
    let raw = value;
    if (value.includes('_')) {
      const match = /^([a-z]+)_([0-9a-f]{32})$/i.exec(value);
      if (
        !match ||
        !Object.values(IdPrefix).includes(match[1] as IdPrefix) ||
        (expectedPrefix && (match[1] as IdPrefix) !== expectedPrefix)
      ) {
        throw new BadRequestException('Invalid ID prefix or UUID');
      }
      const hex = match[2];
      raw = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        raw,
      )
    ) {
      throw new BadRequestException('Invalid UUID ID');
    }
    return raw.toLowerCase();
  }

  decodeInt(value: string | number, expectedPrefix?: IdPrefix): number {
    let raw: string | number = value;
    if (typeof value === 'string' && value.includes('_')) {
      const match = /^([a-z]+)_([0-9]+)$/.exec(value);
      if (
        !match ||
        !Object.values(IdPrefix).includes(match[1] as IdPrefix) ||
        (expectedPrefix && (match[1] as IdPrefix) !== expectedPrefix)
      ) {
        throw new BadRequestException('Invalid integer ID prefix');
      }
      raw = match[2];
    }
    if (
      typeof raw !== 'number' &&
      (typeof raw !== 'string' || !/^[0-9]+$/.test(raw))
    ) {
      throw new BadRequestException('Invalid integer ID');
    }
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('Invalid integer ID');
    }
    return id;
  }

  isPrefixedId(value: string, prefix: IdPrefix): boolean {
    return typeof value === 'string' && value.startsWith(`${prefix}_`);
  }

  getPrefix(value: string): string | null {
    return typeof value === 'string' && value.includes('_')
      ? value.split('_')[0]
      : null;
  }
}
