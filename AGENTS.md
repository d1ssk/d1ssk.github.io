# Working preferences

- The user starts local preview and development servers themselves. Do not start servers or other background services unless the user explicitly requests it. Provide the startup command instead, including when a server would be useful for verification.
- Stop any background service started for an explicitly requested check when that check is complete, unless the user asks to keep it running.
