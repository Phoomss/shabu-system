import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions?: string[];
  kitchenIds?: number[];
}
export type AuthStatus =
  | "checking"
  | "authenticated"
  | "anonymous"
  | "error"
  | "logging-out";
interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  revision: number;
  signedOut: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setAccessToken: (token: string, revision: number) => boolean;
  setStatus: (status: AuthStatus) => void;
  verifyUser: (user: AuthUser, revision: number) => void;
  clearAuth: () => void;
}

// One persisted JSON envelope. Status/revision are never restored as proof of authentication.
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      status: "checking",
      revision: 0,
      signedOut: false,
      setAuth: (user, accessToken) =>
        set((state) => ({
          user,
          accessToken,
          signedOut: false,
          status: "checking",
          revision: state.revision + 1,
        })),
      setAccessToken: (accessToken, revision) => {
        if (get().revision !== revision) return false;
        set({ accessToken });
        return true;
      },
      setStatus: (status) => set({ status }),
      verifyUser: (user, revision) => {
        if (get().revision === revision && get().accessToken)
          set({ user, status: "authenticated" });
      },
      clearAuth: () =>
        set((state) => ({
          user: null,
          accessToken: null,
          signedOut: true,
          status: "anonymous",
          revision: state.revision + 1,
        })),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ user, accessToken, signedOut }) => ({
        user,
        accessToken,
        signedOut,
      }),
      merge: (persisted, current) => {
        const saved = persisted as {
          accessToken?: unknown;
          signedOut?: unknown;
        } | null;
        // Re-fetch user from /auth/me; ignore old/broken double-encoded storage.
        const accessToken =
          saved &&
          typeof saved === "object" &&
          typeof saved.accessToken === "string"
            ? saved.accessToken
            : null;
        return {
          ...current,
          user: null,
          accessToken: saved?.signedOut === true ? null : accessToken,
          signedOut: saved?.signedOut === true,
          status: "checking",
          revision: current.revision + 1,
        };
      },
    },
  ),
);
