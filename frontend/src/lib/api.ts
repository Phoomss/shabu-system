import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore, AuthUser } from "@/stores/authStore";
import { normalizeIds } from "./id-contract";
import { apiUrl } from "./endpoints";

type StaffRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _revision?: number;
  _token?: string | null;
};
const transport = axios.create({ baseURL: apiUrl(), withCredentials: true });
const api = axios.create({ baseURL: apiUrl(), withCredentials: true });
let refreshFlight: { revision: number; promise: Promise<string> } | null = null;
let hydrationFlight: Promise<void> | null = null;
let validationFlight: { revision: number; promise: Promise<void> } | null =
  null;
let logoutFlight: Promise<void> | null = null;

function invalidate(revision: number) {
  if (useAuthStore.getState().revision === revision)
    useAuthStore.getState().clearAuth();
}
export function refreshAccessToken(): Promise<string> {
  const revision = useAuthStore.getState().revision;
  if (refreshFlight?.revision === revision) return refreshFlight.promise;
  const promise = transport
    .post("/auth/refresh", {})
    .then(({ data }) => {
      const token: unknown = data.data?.accessToken;
      if (
        typeof token !== "string" ||
        !useAuthStore.getState().setAccessToken(token, revision)
      )
        throw new Error("Session changed during refresh");
      return token;
    })
    .catch((error: unknown) => {
      // A network/5xx error is retryable; only an actual rejected credential invalidates auth.
      if (
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      )
        invalidate(revision);
      throw error;
    })
    .finally(() => {
      if (refreshFlight?.promise === promise) refreshFlight = null;
    });
  refreshFlight = { revision, promise };
  return promise;
}

api.interceptors.request.use((config: StaffRequest) => {
  const state = useAuthStore.getState();
  config._revision ??= state.revision;
  if (config._revision !== state.revision)
    throw new Error("Session changed before request");
  config._token = state.accessToken;
  if (state.accessToken)
    config.headers.Authorization = `Bearer ${state.accessToken}`;
  else delete config.headers.Authorization;
  return config;
});
api.interceptors.response.use(
  (response) => {
    const config = response.config as StaffRequest;
    if (config._revision !== useAuthStore.getState().revision)
      throw new Error("Stale session response");
    response.data = normalizeIds(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as StaffRequest | undefined;
    if (
      !original ||
      error.response?.status !== 401 ||
      /^\/?auth\/(login|refresh|logout)(?:\?|$)/.test(original.url || "")
    )
      throw error;
    const state = useAuthStore.getState();
    if (
      state.revision !== original._revision ||
      state.status === "logging-out" ||
      state.status === "anonymous"
    )
      throw error;
    if (original._retry) {
      invalidate(state.revision);
      throw error;
    }
    original._retry = true;
    // A late 401 for the old access token reuses the newly refreshed token.
    if (!state.accessToken || original._token === state.accessToken)
      await refreshAccessToken();
    if (useAuthStore.getState().revision !== original._revision)
      throw new Error("Session changed during retry");
    return api(original);
  },
);
export default api;

export async function hydrateAuth(): Promise<void> {
  if (!hydrationFlight)
    hydrationFlight = (async () => {
      await useAuthStore.persist.rehydrate();
      // Remove obsolete copies, never read/write these as credentials again.
      localStorage.removeItem("accessToken");
      document.cookie = "auth-storage=; Max-Age=0; path=/; SameSite=Lax";
    })();
  await hydrationFlight;
}
export async function initializeAuth(): Promise<void> {
  await hydrateAuth();
  if (
    useAuthStore.getState().signedOut &&
    !useAuthStore.getState().accessToken
  ) {
    useAuthStore.getState().setStatus("anonymous");
    return;
  }
  const revision = useAuthStore.getState().revision;
  if (validationFlight?.revision === revision) return validationFlight.promise;
  useAuthStore.getState().setStatus("checking");
  const promise = (async () => {
    try {
      if (!useAuthStore.getState().accessToken) await refreshAccessToken();
      if (useAuthStore.getState().revision !== revision) return;
      const { data } = await api.get("/auth/me");
      const me = data.data as Omit<AuthUser, "role"> & {
        role: { name: string };
      };
      useAuthStore
        .getState()
        .verifyUser({ ...me, role: me.role.name }, revision);
    } catch (error) {
      if (useAuthStore.getState().revision === revision)
        useAuthStore.getState().setStatus("error");
      throw error;
    }
  })().finally(() => {
    if (validationFlight?.promise === promise) validationFlight = null;
  });
  validationFlight = { revision, promise };
  return promise;
}
export function logoutStaff(): Promise<void> {
  if (logoutFlight) return logoutFlight;
  const revision = useAuthStore.getState().revision;
  useAuthStore.getState().setStatus("logging-out");
  const promise = (async () => {
    try {
      // Serialize revocation after any rotation already in progress.
      if (refreshFlight?.revision === revision) await refreshFlight.promise;
      const revoke = () =>
        transport.post(
          "/auth/logout",
          {},
          {
            headers: {
              Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
            },
          },
        );
      try {
        await revoke();
      } catch (error) {
        if (
          !axios.isAxiosError(error) ||
          error.response?.status !== 401 ||
          useAuthStore.getState().revision !== revision
        )
          throw error;
        await refreshAccessToken();
        await revoke();
      }
    } finally {
      invalidate(revision);
    }
  })().finally(() => {
    logoutFlight = null;
  });
  logoutFlight = promise;
  return promise;
}

// Customer credentials remain per-page/in-memory, isolated from staff refresh and cookies.
export const publicApi = axios.create({
  baseURL: apiUrl(),
  withCredentials: false,
});
publicApi.interceptors.response.use((response) => {
  response.data = normalizeIds(response.data);
  return response;
});
export function createCustomerApi(customerToken: string) {
  const client = axios.create({
    baseURL: apiUrl(),
    withCredentials: false,
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  client.interceptors.response.use((response) => {
    response.data = normalizeIds(response.data);
    return response;
  });
  return client;
}
