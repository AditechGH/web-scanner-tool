import axios from "axios";
import type { RepoLite, GitHubRepo } from "./types";

const GITHUB_API_URL = "https://api.github.com";

const githubClient = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
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
 * Creates a new issue on a GitHub repository.
 * @param repoFullName - The full name of the repo (e.g., "owner/repo")
 * @param body - The Markdown body of the issue
 * @param pat - The user's Personal Access Token
 * @returns The URL of the newly created issue
 */
export const createIssue = async (
  repoFullName: string,
  body: string,
  pat: string
): Promise<string> => {
  try {
    const response = await githubClient.post(
      `/repos/${repoFullName}/issues`,
      {
        title: "Potential Secrets Detected in Repository",
        body: body,
      },
      {
        // This is the key: we send the PAT as an auth header
        // for this one request.
        headers: {
          Authorization: `Bearer ${pat}`,
        },
      }
    );
    // Return the URL of the new issue
    return response.data.html_url;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403) {
        throw new Error("Invalid GitHub Token or insufficient permissions.");
      }
      if (error.response.status === 410) {
        throw new Error("Issues are disabled for this repository.");
      }
      throw new Error(`GitHub API error: ${error.response.data.message}`);
    }
    throw new Error("A network error occurred while creating the issue.");
  }
};
