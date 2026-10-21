import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';

describe('Socket session ID compatibility', () => {
  const ids = new IdTransformer();
  const id = '00000000-0000-4000-8000-000000000001';
  const gateway = new EventsGateway(ids);
  it('joins the same room for a REST prefixed ID or raw UUID', () => {
    const join = jest.fn();
    const client = { id: 'test', join } as unknown as Socket;
    gateway.handleSessionJoin({ sessionId: id }, client);
    gateway.handleSessionJoin(
      { sessionId: ids.encode(id, IdPrefix.SESSION) },
      client,
    );
    expect(join.mock.calls).toEqual([[`session:${id}`], [`session:${id}`]]);
  });
  it('rejects malformed IDs without joining', () => {
    const join = jest.fn();
    expect(() =>
      gateway.handleSessionJoin({ sessionId: 'SES-000001' }, {
        join,
      } as unknown as Socket),
    ).toThrow(WsException);
    expect(join).not.toHaveBeenCalled();
  });
});
