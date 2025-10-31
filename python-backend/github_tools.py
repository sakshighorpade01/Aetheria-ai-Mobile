# python-backend/github_tools.py (Expanded Version)

import logging
from typing import List, Optional

from agno.tools import Toolkit
from github import Github, GithubException

from supabase_client import supabase_client

logger = logging.getLogger(__name__)

class GitHubTools(Toolkit):
    """A toolkit for interacting with the GitHub API on behalf of the user."""

    def __init__(self, user_id: str):
        """Initializes the GitHubTools toolkit."""
        super().__init__(
            name="github_tools",
            tools=[
                self.list_repositories,
                self.create_issue,
                # --- NEW: Registering the expanded tools ---
                self.get_file_content,
                self.list_pull_requests,
                self.get_pull_request_details,
                self.add_comment,
            ],
        )
        self.user_id = user_id
        self._github_client: Optional[Github] = None
        self._access_token: Optional[str] = None
        self._token_fetched = False

    def _get_access_token(self) -> Optional[str]:
        # This method is unchanged and remains the same.
        if self._token_fetched:
            return self._access_token
        try:
            response = (
                supabase_client.from_("user_integrations")
                .select("access_token").eq("user_id", self.user_id).eq("service", "github")
                .single().execute()
            )
            if response.data and response.data.get("access_token"):
                self._access_token = response.data["access_token"]
            else:
                self._access_token = None
        except Exception as e:
            logger.error(f"Error fetching GitHub token for user {self.user_id}: {e}")
            self._access_token = None
        self._token_fetched = True
        return self._access_token

    def _get_client(self) -> Optional[Github]:
        # This method is unchanged and remains the same.
        if self._github_client:
            return self._github_client
        access_token = self._get_access_token()
        if access_token:
            self._github_client = Github(access_token)
            return self._github_client
        return None

    # --- EXISTING TOOLS (Unchanged) ---
    def list_repositories(self) -> str:
        # This method is unchanged.
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repos = client.get_user().get_repos()
            repo_list = [repo.full_name for repo in repos]
            if not repo_list: return "No repositories found for your account."
            return "\n".join(repo_list)
        except GithubException as e:
            return f"Error accessing GitHub API: {e.data.get('message', 'Invalid credentials')}."

    def create_issue(self, repo_full_name: str, title: str, body: str) -> str:
        # This method is unchanged.
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repo = client.get_repo(repo_full_name)
            issue = repo.create_issue(title=title, body=body)
            return f"Successfully created issue #{issue.number} in {repo_full_name}. URL: {issue.html_url}"
        except GithubException as e:
            if e.status == 404: return f"Error: Repository '{repo_full_name}' not found."
            return f"Error creating issue: {e.data.get('message', 'Unknown error')}."

    # --- NEW EXPANDED TOOLS ---
    def get_file_content(self, repo_full_name: str, file_path: str) -> str:
        """
        Retrieves the content of a specific file from a GitHub repository.

        Args:
            repo_full_name: The full name of the repository (e.g., 'owner/repo-name').
            file_path: The full path to the file within the repository (e.g., 'src/main.py').

        Returns:
            The content of the file as a string, or an error message.
        """
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repo = client.get_repo(repo_full_name)
            contents = repo.get_contents(file_path)
            if contents.encoding == "base64":
                return contents.decoded_content.decode('utf-8')
            return contents.decoded_content
        except GithubException as e:
            if e.status == 404: return f"Error: File or repository not found at '{repo_full_name}/{file_path}'."
            return f"Error getting file content: {e.data.get('message', 'Unknown error')}."

    def list_pull_requests(self, repo_full_name: str, state: str = 'open') -> str:
        """
        Lists pull requests for a specified repository.

        Args:
            repo_full_name: The full name of the repository (e.g., 'owner/repo-name').
            state: The state of the pull requests to list. Can be 'open', 'closed', or 'all'.

        Returns:
            A formatted string listing the pull requests, or an error message.
        """
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repo = client.get_repo(repo_full_name)
            pulls = repo.get_pulls(state=state, sort='created', direction='desc')
            if pulls.totalCount == 0:
                return f"No {state} pull requests found in {repo_full_name}."
            
            pr_summaries = [
                f"PR #{pr.number}: {pr.title} (by {pr.user.login})"
                for pr in pulls
            ]
            return "\n".join(pr_summaries)
        except GithubException as e:
            return f"Error listing pull requests: {e.data.get('message', 'Unknown error')}."

    def get_pull_request_details(self, repo_full_name: str, pr_number: int) -> str:
        """
        Gets the detailed information for a single pull request, including changed files.

        Args:
            repo_full_name: The full name of the repository (e.g., 'owner/repo-name').
            pr_number: The number of the pull request.

        Returns:
            A detailed summary of the pull request.
        """
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repo = client.get_repo(repo_full_name)
            pr = repo.get_pull(pr_number)
            changed_files = [f.filename for f in pr.get_files()]
            
            details = (
                f"PR #{pr.number}: {pr.title}\n"
                f"Author: {pr.user.login}\n"
                f"State: {pr.state}\n"
                f"URL: {pr.html_url}\n\n"
                f"Description:\n{pr.body}\n\n"
                f"Files Changed ({len(changed_files)}):\n" + "\n".join(f"- {file}" for file in changed_files)
            )
            return details
        except GithubException as e:
            if e.status == 404: return f"Error: Pull request #{pr_number} not found in '{repo_full_name}'."
            return f"Error getting PR details: {e.data.get('message', 'Unknown error')}."

    def add_comment(self, repo_full_name: str, issue_number: int, comment_body: str) -> str:
        """
        Adds a comment to a specified issue or pull request.

        Args:
            repo_full_name: The full name of the repository (e.g., 'owner/repo-name').
            issue_number: The number of the issue or pull request to comment on.
            comment_body: The text of the comment to post.

        Returns:
            A confirmation message with a link to the new comment.
        """
        client = self._get_client()
        if not client: return "GitHub account not connected."
        try:
            repo = client.get_repo(repo_full_name)
            # The same method works for both issues and PRs
            issue = repo.get_issue(number=issue_number)
            comment = issue.create_comment(comment_body)
            return f"Successfully added comment to issue/PR #{issue_number}. URL: {comment.html_url}"
        except GithubException as e:
            if e.status == 404: return f"Error: Issue or PR #{issue_number} not found in '{repo_full_name}'."
            return f"Error adding comment: {e.data.get('message', 'Unknown error')}."