import axios from 'axios';
import { normalizeIds } from './id-contract';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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
  (res) => {
    res.data = normalizeIds(res.data);
    return res;
  },
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
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

// Legacy QR exchange only; scoped customer calls use createCustomerApi().
export const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: false,
});
publicApi.interceptors.response.use((res) => {
  res.data = normalizeIds(res.data);
  return res;
});

// Customer credentials are per-page/in-memory; never share the staff refresh flow.
export function createCustomerApi(customerToken: string) {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: false,
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  client.interceptors.response.use((response) => {
    response.data = normalizeIds(response.data);
    return response;
  });
  return client;
}
