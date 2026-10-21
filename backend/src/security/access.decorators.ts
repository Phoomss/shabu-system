import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
export const ACCESS = 'shabu.access';
export const RESOURCE = 'shabu.resource';
export const PERMISSION = 'shabu.permission';
export const PublicEndpoint = () => SetMetadata(ACCESS, 'public');
export const CustomerEndpoint = () =>
  applyDecorators(
    SetMetadata(ACCESS, 'customer'),
    ApiBearerAuth('Customer'),
    ApiUnauthorizedResponse(),
    ApiForbiddenResponse(),
  );
export const Permission = (permission: string) =>
  SetMetadata(PERMISSION, permission);
export const EmployeeResource = (resource: string) =>
  applyDecorators(
    SetMetadata(RESOURCE, resource),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse(),
    ApiForbiddenResponse(),
  );
