import axios from "axios";
import type { ScanResponse } from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Calls our backend /api/scan endpoint
 */
export const scanRepository = async (
  owner: string,
  name: string,
  token: string | null = null
): Promise<ScanResponse> => {
  try {
    const response = await apiClient.post<ScanResponse>("/api/scan", {
      owner,
      repo: name,
      token,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data as { detail: string };
      throw new Error(apiError.detail || "An unknown API error occurred.");
    }
    throw new Error("A network error occurred. Is the backend server running?");
  }
};
