import { io, Socket } from 'socket.io-client';
import api from './api';
import { normalizeIds } from './id-contract';

let socket: Socket | null = null;
let isConnected = false;
let onConnectCallbacks: Array<(socketId: string) => void> = [];

let staffRecovery: Promise<void> | null = null;
function recoverStaffSocket() {
  if (staffRecovery) return;
  staffRecovery = api.get('/auth/me')
    .then(() => { socket?.connect(); })
    .catch(() => disconnectSocket())
    .finally(() => { staffRecovery = null; });
}

export const getSocket = (): Socket => {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    console.log('[Socket] Creating new socket connection to:', url);
    
    socket = io(url, {
      auth: (callback) => callback({ accessToken: localStorage.getItem('accessToken') }),
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Socket.IO invokes catch-all listeners before the event-specific listeners.
    socket.onAny((_event, ...payloads: unknown[]) => {
      for (const payload of payloads) {
        if (payload && typeof payload === 'object') {
          Object.assign(payload, normalizeIds(payload));
        }
      }
    });

    socket.on('connect', () => {
      const id = socket?.id || 'unknown';
      console.log('[Socket] ✅ Connected:', id);
      isConnected = true;
      // Execute all registered callbacks
      onConnectCallbacks.forEach(cb => cb(id));
    });

    socket.on('connect_error', (error: Error & { data?: { status?: number } }) => {
      console.error('[Socket] ❌ Connection error:', error.message);
      if (error.data?.status === 401) recoverStaffSocket();
      isConnected = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      isConnected = false;
      if (reason === 'io server disconnect') {
        recoverStaffSocket();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      isConnected = true;
    });
  }
  return socket;
};

export const addConnectListener = (callback: (socketId: string) => void) => {
  if (isConnected && socket) {
    // Already connected, call immediately
    callback(socket.id || 'unknown');
  } else {
    // Add to callbacks queue
    onConnectCallbacks.push(callback);
  }
};

export const removeConnectListener = (callback: (socketId: string) => void) => {
  onConnectCallbacks = onConnectCallbacks.filter(cb => cb !== callback);
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    console.log('[Socket] Connecting...');
    s.connect();
  } else {
    console.log('[Socket] Already connected:', s.id);
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('[Socket] Disconnecting...');
    socket.disconnect();
    socket = null;
    isConnected = false;
    onConnectCallbacks = [];
  }
};

// Dedicated customer connection: no staff token, singleton, or persistent storage.
export function createCustomerSocket(customerToken: string): Socket {
  const customerSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
    auth: { customerToken }, autoConnect: false, reconnection: true,
    transports: ['websocket', 'polling'],
  });
  customerSocket.onAny((_event, ...payloads: unknown[]) => {
    for (const payload of payloads) {
      if (payload && typeof payload === 'object') Object.assign(payload, normalizeIds(payload));
    }
  });
  return customerSocket;
}
