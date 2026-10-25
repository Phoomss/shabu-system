import axios from 'axios';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // สำหรับ refresh token cookie
});

// Request interceptor — แนบ access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — refresh token อัตโนมัติ
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login')) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        localStorage.setItem('accessToken', data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// Public API client — ไม่ใช้ authentication (สำหรับ QR ordering)
export const publicApi = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});
