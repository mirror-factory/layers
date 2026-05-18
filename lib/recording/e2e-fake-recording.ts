export function isE2eFakeRecordingEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PLAYWRIGHT === "1" &&
    process.env.LAYERS_E2E_FAKE_RECORDING === "1"
  );
}
