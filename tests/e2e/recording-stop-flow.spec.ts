import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingBeforeNavigation } from "./helpers/onboarding";

const LATEST_DRAFT_KEY = "layers-recording-draft:latest";
const FINAL_TURN_TEXT = "Ship it";

async function installFakeRecordingBrowserApis(page: Page) {
  await page.addInitScript((finalTurnText) => {
    const fakeTrack = { stop() {} };
    const fakeStream = { getTracks: () => [fakeTrack] };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => fakeStream,
      },
    });

    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: async () => ({
          state: "granted",
          addEventListener() {},
          removeEventListener() {},
        }),
      },
    });

    class FakeAudioContext {
      sampleRate = 16000;
      destination = {};
      audioWorklet = {
        addModule: async () => undefined,
      };

      createMediaStreamSource() {
        return { connect() {} };
      }

      createGain() {
        return {
          gain: { value: 1 },
          connect() {},
          disconnect() {},
        };
      }

      createAnalyser() {
        return {
          fftSize: 256,
          frequencyBinCount: 32,
          getByteTimeDomainData(data: Uint8Array) {
            data.fill(128);
          },
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    class FakeAudioWorkletNode {
      port = {
        onmessage: null,
        postMessage() {},
      };

      connect() {}
      disconnect() {}
    }

    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly url: string;
      readonly protocol = "";
      readyState = FakeWebSocket.CONNECTING;
      binaryType: BinaryType = "blob";
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        window.setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.(new Event("open"));
          window.setTimeout(() => {
            this.onmessage?.(
              new MessageEvent("message", {
                data: JSON.stringify({
                  type: "Turn",
                  transcript: finalTurnText,
                  end_of_turn: true,
                  speaker: "A",
                  words: [
                    {
                      start: 0,
                      end: 400,
                      confidence: 0.98,
                    },
                  ],
                }),
              }),
            );
          }, 25);
        }, 25);
      }

      addEventListener() {}
      removeEventListener() {}
      send() {}

      close(code = 1000, reason = "") {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.(
          new CloseEvent("close", {
            code,
            reason,
            wasClean: code === 1000,
          }),
        );
      }
    }

    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    window.AudioWorkletNode =
      FakeAudioWorkletNode as unknown as typeof AudioWorkletNode;
    window.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  }, FINAL_TURN_TEXT);
}

async function openLiveRecorder(page: Page) {
  await installFakeRecordingBrowserApis(page);
  await completeOnboardingBeforeNavigation(page);
  await page.goto("/record/live", { waitUntil: "load" });
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible();
}

test.describe("Recording Stop flow", () => {
  test("finalizes a live recording and renders the completed meeting detail page", async ({
    page,
  }) => {
    await openLiveRecorder(page);

    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(
      page.getByRole("button", { name: "Stop recording" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(FINAL_TURN_TEXT)).toBeVisible();

    await page.getByRole("button", { name: "Stop recording" }).click();

    await expect(page).toHaveURL(/\/meetings\/[^/]+$/);
    await expect(page.getByText("Summary ready")).toBeVisible();
    await expect(
      page.getByText("The recording was too short to summarize."),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Transcript/ }).click();
    await expect(page.getByText(FINAL_TURN_TEXT)).toBeVisible();

    const latestDraft = await page.evaluate(
      (key) => localStorage.getItem(key),
      LATEST_DRAFT_KEY,
    );
    expect(latestDraft).toBeNull();
  });

  test("keeps the local draft and stays on the recorder when finalize fails", async ({
    page,
  }) => {
    await page.route("**/api/transcribe/stream/finalize", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Meeting not found" }),
      });
    });

    await openLiveRecorder(page);

    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(
      page.getByRole("button", { name: "Stop recording" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(FINAL_TURN_TEXT)).toBeVisible();

    await page.getByRole("button", { name: "Stop recording" }).click();

    await expect(page).toHaveURL(/\/record\/live$/);
    await expect(
      page.getByText("Finalize failed. A local draft was kept on this device."),
    ).toBeVisible();

    const draft = await page.evaluate((latestKey) => {
      const meetingId = localStorage.getItem(latestKey);
      if (!meetingId) return null;
      return localStorage.getItem(`layers-recording-draft:${meetingId}`);
    }, LATEST_DRAFT_KEY);

    expect(draft).toContain(FINAL_TURN_TEXT);
  });
});
