import { create } from "zustand";
import type {
  RepoLite,
  ScanResponse,
  ScanStatus,
  ScanError,
} from "../lib/types";
import { scanRepository } from "../lib/backendApi";

// Define the shape of our state and the actions
interface ScanState {
  selectedRepo: RepoLite | null;
  scanResult: ScanResponse | null;
  status: ScanStatus;
  error: ScanError | null;

  // Actions
  selectRepo: (repo: RepoLite | null) => void;
  startScan: (token?: string) => Promise<void>;
  clearScan: () => void;
}

// Create the store
export const useScanStore = create<ScanState>((set, get) => ({
  // --- Initial State ---
  selectedRepo: null,
  scanResult: null,
  status: "idle",
  error: null,

  // --- Actions ---

  /**
   * Sets the selected repository, clears any old results,
   * and sets the status to 'idle' (ready to scan).
   */
  selectRepo: (repo) => {
    set({
      selectedRepo: repo,
      scanResult: null,
      status: "idle",
      error: null,
    });
  },

  /**
   * The main async action. It gets the current selectedRepo
   * from the state, calls the backend API, and updates
   * the state with the result or an error.
   */
  startScan: async (token: string | null = null) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;

    set({ status: "loading", error: null, scanResult: null });

    try {
      const result = await scanRepository(
        selectedRepo.owner,
        selectedRepo.name,
        token
      );
      set({ scanResult: result, status: "success" });
    } catch (err) {
      let message = "An unknown error occurred.";
      let resetAt: number | undefined = undefined;
      let status: number | undefined = undefined;

      if (err instanceof Error) {
        message = err.message;
        if (
          typeof err === "object" &&
          err &&
          "resetAt" in err &&
          typeof err.resetAt === "number"
        ) {
          resetAt = err.resetAt;
        }

        if (
          typeof err === "object" &&
          err &&
          "status" in err &&
          typeof err.status === "number"
        ) {
          status = err.status;
        }
      }

      const apiError: ScanError = { message, resetAt, status };
      set({ error: apiError, status: "error" });
    }
  },

  /**
   * Clears the selected repo and all results,
   * returning the app to its initial state.
   */
  clearScan: () => {
    set({
      selectedRepo: null,
      scanResult: null,
      status: "idle",
      error: null,
    });
  },
}));
