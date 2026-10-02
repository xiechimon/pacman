Title: Browsing sub-issues - GitHub Docs

URL Source: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues

Markdown Content:
Learn how to navigate issue hierarchy in your repositories.

You can add sub-issues to an issue to quickly break down larger pieces of work into smaller issues. Sub-issues add support for hierarchies of issues on GitHub by creating relationships between your issues. You can create multiple levels of sub-issues that accurately represent your project by breaking down tasks into exactly the amount of detail that you and your team require.

## [Navigating issue hierarchy](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues#navigating-issue-hierarchy)

You can browse through all levels of sub-issues from the parent issue.

1.   Navigate to the parent issue.

2.   To view the sub-issues under another sub-issue, click the expand toggle ().

![Image 1: Screenshot of a sub-issues section. The expand toggle is highlighted with an orange rectangle.](https://docs.github.com/assets/cb-44873/images/help/issues/sub-issue-expand.png)

## [Finding a sub-issue's parent issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues#finding-a-sub-issues-parent-issue)

When you view a sub-issue, you can always find a link back to the parent issue in the header below the issue title.

![Image 2: Screenshot of a sub-issue's header. The link to the parent issue, "Parent: create a scoreboard", is highlighted with an orange rectangle.](https://docs.github.com/assets/cb-17326/images/help/issues/sub-issue-parent.png)

## [Using sub-issues in your projects](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues#using-sub-issues-in-your-projects)

You can add sub-issues to your projects and make use of the hierarchy data for building views, grouping items, and filtering your views. See [About parent issue and sub-issue progress fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields).

## [Browsing issue hierarchy with GitHub CLI](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues#browsing-issue-hierarchy-with-github-cli)

GitHub CLI is an open source tool for using GitHub from your computer's command line. When you're working from the command line, you can use the GitHub CLI to save time and avoid switching context. To learn more about GitHub CLI, see [About GitHub CLI](https://docs.github.com/en/github-cli/github-cli/about-github-cli).

To view a parent issue along with its sub-issues, use the `gh issue view` subcommand.

```
gh issue view ISSUE-NUMBER
```

The output includes the parent reference (if any) and a "Sub-issues" section that lists each sub-issue with its state and completion progress.

```
Build a scoreboard octo-org/octo-repo#123
Feature · Open • monalisa opened 3 days ago • 2 comments
Assignees: monalisa
Labels: enhancement
Type: Feature

  Track player scores across rounds.

Sub-issues · 1/3 (33%)
Closed octo-org/octo-repo#124 Design scoreboard layout
Open octo-org/octo-repo#125 Persist scores between sessions
Open octo-org/octo-repo#126 Add a leaderboard view

View this issue on GitHub: https://github.com/octo-org/octo-repo/issues/123
```

To get the same information in a machine-readable form, use the `--json` flag with the `parent`, `subIssues`, and `subIssuesSummary` fields.

```
gh issue view ISSUE-NUMBER --json parent,subIssues,subIssuesSummary
```
