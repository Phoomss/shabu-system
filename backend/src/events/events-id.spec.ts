import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';
import { SocketIdentityService } from '../security/socket-identity.service';
import { PermissionPolicy } from '../security/policy';

describe('Authenticated Socket session ID compatibility', () => {
  const ids = new IdTransformer();
  const id = '00000000-0000-4000-8000-000000000001';
  const identity = {
    kind: 'customer',
    id,
    expiresAt: Date.now() + 60000,
    token: 'unit-test-token',
  };
  const identities = {
    revalidate: jest.fn().mockResolvedValue(identity),
  } as unknown as SocketIdentityService;
  const gateway = new EventsGateway(ids, identities, {} as PermissionPolicy);
  it('authenticated customer joins the same room for REST prefixed ID or raw UUID', async () => {
    const join = jest.fn();
    const client = {
      id: 'test',
      join,
      data: { identity },
    } as unknown as Socket;
    await gateway.handleSessionJoin({ sessionId: id }, client);
    await gateway.handleSessionJoin(
      { sessionId: ids.encode(id, IdPrefix.SESSION) },
      client,
    );
    expect(join.mock.calls).toEqual([[`session:${id}`], [`session:${id}`]]);
  });
  it('rejects malformed IDs and unauthenticated clients without joining', async () => {
    const join = jest.fn();
    await expect(
      gateway.handleSessionJoin({ sessionId: 'SES-000001' }, {
        join,
        data: { identity },
      } as unknown as Socket),
    ).rejects.toThrow(WsException);
    await expect(
      gateway.handleSessionJoin({ sessionId: id }, {
        join,
        data: {},
      } as unknown as Socket),
    ).rejects.toThrow(WsException);
    expect(join).not.toHaveBeenCalled();
  });
});
