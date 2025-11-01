import axios from "axios";
import type { RepoLite, GitHubRepo } from "./types";

const GITHUB_API_URL = "https://api.github.com";

const githubClient = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
});

/**
 * Searches the GitHub API for repositories.
 * @param query The search term
 * @returns A promise that resolves to a list of simplified RepoLite objects
 */
export const searchRepos = async (query: string): Promise<RepoLite[]> => {
  if (!query) {
    return [];
  }

  try {
    // We add 'in:name' to make searches more relevant
    const response = await githubClient.get(
      `/search/repositories?q=${query}+in:name&sort=stars&order=desc&per_page=10`
    );

    // Normalize the full API response to our simple RepoLite type
    const items = response.data.items as GitHubRepo[];
    const repos: RepoLite[] = items.map((item) => ({
      owner: item.owner.login,
      name: item.name,
      fullName: item.full_name,
      stars: item.stargazers_count,
      updatedAt: item.updated_at,
    }));

    return repos;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`GitHub API error: ${error.response.data.message}`);
    }
    throw new Error("A network error occurred while searching GitHub.");
  }
};

/**
 * SKELETON: We will implement this later.
 */
export const createIssue = async (
  repoFullName: string,
  body: string,
  pat: string
): Promise<string> => {
  console.log("TODO: createIssue", repoFullName, body, pat);
  return "https://github.com/mock/issue/1";
};
