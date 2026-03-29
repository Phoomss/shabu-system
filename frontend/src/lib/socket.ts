import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let isConnected = false;
let onConnectCallbacks: Array<(socketId: string) => void> = [];

export const getSocket = (): Socket => {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    console.log('[Socket] Creating new socket connection to:', url);
    
    socket = io(url, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      const id = socket?.id || 'unknown';
      console.log('[Socket] ✅ Connected:', id);
      isConnected = true;
      // Execute all registered callbacks
      onConnectCallbacks.forEach(cb => cb(id));
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] ❌ Connection error:', error.message);
      console.error('[Socket] Error details:', error);
      isConnected = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      isConnected = false;
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