import type { RepoLite } from "./types";

// SKELETON: We will implement these later
export const searchRepos = async (query: string): Promise<RepoLite[]> => {
  console.log("TODO: searchRepos", query);
  // Simulate a search
  if (query.includes("fail")) {
    return [];
  }
  return [
    {
      owner: "rainforest-builder",
      name: "tech-test-scannable-repo",
      fullName: "rainforest-builder/tech-test-scannable-repo",
      stars: 123,
      updatedAt: new Date().toISOString(),
    },
  ];
};

export const createIssue = async (
  repoFullName: string,
  body: string,
  pat: string
): Promise<string> => {
  console.log("TODO: createIssue", repoFullName, body, pat);
  return "https://github.com/mock/issue/1";
};
