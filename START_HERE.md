# Start here

This folder is the starting point for your Claude Code project. Drop it into an empty folder and Claude Code picks it up automatically.

## What's inside
- `CLAUDE.md` is read by Claude Code at the start of every session. It holds the stack, the commands and the rules it must never break.
- `docs/00_master_project.md` is the full spec. Claude reads the relevant part when it needs it.
- `docs/BUILD_PLAN.md` splits the build into milestones, each with a ready made prompt.
- `.claude/rules/` holds extra rules that only load when Claude touches privacy code, the map or the studio.

## First session
1. Make an empty folder and copy everything in this kit into it, including the hidden `.claude` folder.
2. Run `git init` there, or create an empty GitHub repo and clone it first.
3. Open Claude Code in that folder and type `/context`. CLAUDE.md should show up under memory files.
4. Switch to plan mode, open `docs/BUILD_PLAN.md` and paste the prompt for milestone 0.
5. Read the plan, push back on anything that feels off, then let it build.

## Rhythm that works
- One milestone per session. Start a fresh session for the next one.
- Commit when the milestone's "done when" list is true.
- When you settle one of the open decisions in section 14 of the spec, tell Claude and let it update the spec.
- Milestone 4 is the one that matters most. After that the site is real and you can start publishing.

## Things only you can do
- Create the Cloudflare account and log Wrangler in with `npx wrangler login`.
- Set up Cloudflare Access in the dashboard. Claude will give you the steps.
- Approve anything that costs money, like a custom domain or an AI translation API key.
