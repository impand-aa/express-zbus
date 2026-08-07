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
