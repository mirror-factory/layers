# Native Smoke Flows

This directory contains the Tier 5 native proof harness for Layers.

Run locally against an installed simulator/emulator build:

```bash
MAESTRO_RUN=1 MAESTRO_APP_ID=com.mirrorfactory.layers pnpm test:native:smoke
```

Make it blocking in CI or before native auto-merge:

```bash
NATIVE_REQUIRED=1 MAESTRO_RUN=1 pnpm test:native:smoke
```

The first flow only proves app launch. Native bug tickets should add targeted
flows here for safe areas, OAuth deep-link return, microphone permission,
background/foreground recovery, and platform navigation.
