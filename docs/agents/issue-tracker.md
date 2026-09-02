# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues at `internetOnion/life-goods`. Use the `gh` CLI for operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from the configured Git remote when commands run inside this clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill operations

When a skill says to publish a ticket, create a GitHub issue. When it says to fetch a ticket, read the complete issue body and comments.

Publish dependency-ordered tickets with blockers first. Represent blocking edges using GitHub native issue dependencies:

1. Resolve the blocker's database ID with `gh api repos/internetOnion/life-goods/issues/<number> --jq .id`.
2. Add the dependency with `gh api --method POST repos/internetOnion/life-goods/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker-database-id>`.

If native dependencies are unavailable, put `Blocked by: #<number>` in the blocked issue body. A ticket is ready only when every blocking issue is closed.
