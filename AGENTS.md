# Working preferences

- The user starts local preview and development servers themselves. Do not start servers or other background services unless the user explicitly requests it. Provide the startup command instead, including when a server would be useful for verification.
- Stop any background service started for an explicitly requested check when that check is complete, unless the user asks to keep it running.


## Documentation audience

Keep public-facing READMEs focused on the project, published URL, user instructions, limitations, and licensing. Put maintainer-only setup, deployment, analytics administration, implementation details, and validation procedures in the dedicated documents below. Keep personal machine paths and temporary work notes out of committed documentation. READMEs inside developer-only directories may serve as technical indexes.

- [docs/maintenance.md](docs/maintenance.md)
- [portfolio/MAINTENANCE.md](portfolio/MAINTENANCE.md)
