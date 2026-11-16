# Shiftmaker Web

Bootstrap-based React editor for BUSEV3 shift modules. It is designed around the exact shift contract used in the Roblox source:

- local journey tables act as reusable route building blocks
- `SHIFT._plan` stores numeric shift orders such as `[1]`, `[2]`, `[3]`
- each plan node is either `{time="HH:MM"}` or `{journeys = {...}, loopUntil = "HH:MM"}`
- exporting produces raw Luau module source
- importing parses existing Luau shift modules back into the editor

## Commands

```bash
npm install
npm run dev
npm run build
npm test
```

## Features

- Journey library for reusable shift blocks
- Custom route `Orders` editing for depot and manipulation trips
- SHIFT._plan order builder with time markers and ordered journey sequences
- Batch order cloning with automatic time shifting
- Raw Luau export and import
- Round-trip tests against real samples in `../BUSEV3_source/Shifts`

## Notes

- The app lives entirely inside `shiftmaker-web`.
- No files inside `BUSEV3_source` are modified.
- The importer/exporter is validated with real project shift modules.

## Organizations

All data (shifts, reference modules, publish requests) belongs to an organization. Users reach an organization through a membership that carries their role there (`admin` or `member`). Admin-only actions, such as saving reference modules or completing publish requests, check the role in the active organization. Users who belong to several organizations can switch between them from the account menu.

### Admin panel

Site admins manage everything from **Admin panel** in the account menu. From there they can:

- create organizations and rename them
- add users to organizations, change their role in each, or remove them from any organization. This works from either tab: per organization or per user.
- create users, optionally adding them to one or more organizations at once
- reset passwords, which signs the user out and shows a new temporary password
- delete users
- grant or revoke site admin

New users get a temporary password that must be changed on first sign-in.

A site admin is a user whose `users` document has `siteAdmin: true`. Set this once on your own account in Atlas. After that you can grant it to others from the panel. You can't demote, delete or reset your own account from the panel.

Org-scoped API routes live under `/api/organizations/:organizationId/...`.

Migration `005-add-organizations` (`npm run migrate`) moves existing data into a default organization. Set its name and slug with `DEFAULT_ORGANIZATION_NAME` and `DEFAULT_ORGANIZATION_SLUG`. The migration also adds every existing user to it, mapping the legacy `rank: "admin"` to the `admin` role.
