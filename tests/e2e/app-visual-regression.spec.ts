import { expect, test, type Page } from "@playwright/test";

import {
  mobilityVisualPages,
  mobilityVisualViewports,
  type MobilityVisualPage,
} from "../../apps/app/src/testing/mobility-visual-registry";
import {
  loginThroughPhoneVerification,
  openAuthenticatedPage,
} from "./helpers/authenticated-app";
import { mockMobilityDashboard, syntheticTrip } from "./helpers/mobility-fixtures";

const passengerPages = mobilityVisualPages.filter(
  (page) => page.group === "passenger" && page.baselineState === "active",
);
const driverPages = mobilityVisualPages.filter(
  (page) => page.group === "driver" && page.baselineState === "active",
);
const sharedPages = mobilityVisualPages.filter(
  (page) => page.group === "shared" && page.baselineState === "active",
);
const visualFixtureTime = Date.parse("2026-07-15T01:41:00.000Z");

test.describe("移动端核心页面视觉回归", () => {
  test("390、430 与桌面端覆盖 R01–R08、S01–S03", async ({ page }) => {
    test.setTimeout(600_000);
    await prepareVisualPage(page);
    await setPassengerFixture(page, "passenger-ready");
    await openVisualSession(page);
    await page.evaluate(() => {
      localStorage.setItem("pollycar.preference.theme", "light");
      localStorage.setItem("pollycar.qa.font-scale", "1");
    });
    await page.reload();
    await expect(page).toHaveURL(/\/ride-home$/);

    for (const viewport of mobilityVisualViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const visualPage of passengerPages) {
        await setPassengerFixture(page, visualPage.fixture);
        await page.goto(visualPage.route);
        await expect(page.getByText(visualPage.expectedAnchor).first()).toBeVisible();
        await expect(page).toHaveScreenshot(`${visualPage.id}-${viewport.id}.png`, {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          maxDiffPixels: 120,
        });
      }

      for (const visualPage of sharedPages) {
        await setSharedFixture(page, visualPage.fixture);
        await page.goto(visualPage.route);
        await expect(page.getByText(visualPage.expectedAnchor).first()).toBeVisible();
        await expect(page).toHaveScreenshot(`${visualPage.id}-${viewport.id}.png`, {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          maxDiffPixels: 120,
        });
      }
    }
  });

  test("390、430 与桌面端覆盖 D01–D10", async ({ page }) => {
    test.setTimeout(600_000);
    await prepareVisualPage(page);
    await openAuthenticatedPage(page, "/driver-home");

    for (const viewport of mobilityVisualViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const visualPage of driverPages) {
        await setDriverFixture(page, visualPage.fixture);
        await page.goto(visualPage.route);
        await expect(page.getByText(visualPage.expectedAnchor).first()).toBeVisible();
        await expect(page).toHaveScreenshot(`${visualPage.id}-${viewport.id}.png`, {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          maxDiffPixels: 120,
        });
      }
    }
  });
});

async function openVisualSession(page: Page) {
  await loginThroughPhoneVerification(page, { completeAdultEligibility: false });
  if (/\/adult-eligibility$/.test(new URL(page.url()).pathname)) {
    const enterHome = page.getByRole("button", { name: "进入乘客首页" });
    await expect(enterHome).toBeVisible();
    await enterHome.click();
  }
  await expect(page).toHaveURL(/\/ride-home$/);
}

async function prepareVisualPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("pollycar.preference.theme", "light");
    window.localStorage.setItem("pollycar.qa.font-scale", "1");
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });
  await page.clock.setFixedTime(new Date("2026-07-15T01:41:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(
    "**/v1/internal-sandbox/app/map/routes/driving",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routeId: "visual-route-r03",
          origin: { latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" },
          destination: { latitude: 31.1979, longitude: 121.3275, coordinateSystem: "gcj02" },
          distanceMeters: 17_000,
          durationSeconds: 1_980,
          encodedPolyline: "visual-route",
          generatedAt: "2026-07-15T01:41:00.000Z",
          expiresAt: "2026-07-15T01:51:00.000Z",
          provider: "synthetic",
          includesLiveTraffic: false,
        }),
      });
    },
  );
  await page.route(
    "**/v1/internal-sandbox/app/synthetic-trips/booking-availability**",
    async (route) => {
      const slots = [
        ["2026-07-15T02:20:00.000Z", "2026-07-15T02:30:00.000Z"],
        ["2026-07-15T02:30:00.000Z", "2026-07-15T02:40:00.000Z"],
        ["2026-07-15T02:40:00.000Z", "2026-07-15T02:50:00.000Z"],
        ["2026-07-15T02:50:00.000Z", "2026-07-15T03:00:00.000Z"],
      ].map(([startsAt, endsAt]) => ({ startsAt, endsAt, available: true }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          serverNow: "2026-07-15T01:41:00.000Z",
          timezone: "Asia/Shanghai",
          immediateAvailable: true,
          minimumLeadMinutes: 30,
          slotDurationMinutes: 10,
          latestScheduledAt: "2026-07-18T01:41:00.000Z",
          quickSlots: slots,
          availableSlots: slots,
          serviceWindows: [{ weekday: 3, startsAtMinute: 0, endsAtMinute: 1440 }],
        }),
      });
    },
  );
  await page.route(
    "**/v1/internal-sandbox/app/adult-eligibility",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accountId: "synthetic-account-7",
          state: "verified",
          version: 1,
          requiredDocumentSides: ["front", "back"],
          uploadedDocuments: [],
          checks: {
            document: { status: "passed" },
            age: { status: "passed" },
            liveness: { status: "passed" },
            faceMatch: { status: "passed" },
          },
          recoveryAction: "none",
          businessAccessAllowed: true,
          realIdentityDataEnabled: false,
          realBiometricDataEnabled: false,
          externalIdentityProviderEnabled: false,
          consent: {
            identityProcessingAuthorized: true,
            biometricProcessingAuthorized: true,
            thirdPartyProcessingAuthorized: true,
          },
          synthetic: true,
        }),
      });
    },
  );
  await page.route(
    "**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          applicationId: "vehicle-application-7",
          accountId: "synthetic-account-7",
          status: "approved",
          version: 3,
          ownerIdentityAvailable: true,
          maxPassengerCount: 3,
          vehicleType: "中大型轿车 · 示例 A",
          insuranceExpiresOn: "2027-08-31",
          syntheticAttachmentId: "synthetic-insurance-a",
          requestedMaterialCodes: [],
          timeline: [],
          synthetic: true,
        }),
      });
    },
  );
  await page.route(
    "**/v1/internal-sandbox/app/synthetic-trips/*/vehicle-location",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          freshness: "fresh",
          receivedAt: "2026-07-15T01:40:58.000Z",
          nextUploadAllowedAt: "2026-07-15T01:41:03.000Z",
          uploadIntervalSeconds: 5,
          stopped: false,
          realLocationEnabled: false,
          synthetic: true,
        }),
      });
    },
  );
}

async function setPassengerFixture(page: Page, fixture: MobilityVisualPage["fixture"]) {
  await page.unroute("**/v1/internal-sandbox/app/synthetic-trips/dashboard");
  if (fixture === "passenger-matching") {
    await mockMobilityDashboard(page, {
      passengerTrip: syntheticTrip(
        "paid_pending_match",
        "synthetic-trip-mobility-e2e",
        2,
        visualFixtureTime,
      ),
    });
    return;
  }
  if (fixture === "passenger-pickup" || fixture === "passenger-cancellation") {
    await mockMobilityDashboard(page, {
      passengerTrip: syntheticTrip(
        "accepted",
        "synthetic-trip-mobility-e2e",
        2,
        visualFixtureTime,
      ),
    });
    return;
  }
  if (fixture === "passenger-active") {
    await mockMobilityDashboard(page, {
      passengerTrip: syntheticTrip(
        "in_progress",
        "synthetic-trip-mobility-e2e",
        2,
        visualFixtureTime,
      ),
    });
    return;
  }
  if (fixture === "passenger-completion") {
    await mockMobilityDashboard(page, {
      passengerTrip: syntheticTrip(
        "completed",
        "synthetic-trip-mobility-e2e",
        2,
        visualFixtureTime,
      ),
    });
    return;
  }
  await mockMobilityDashboard(page);
}

async function setDriverFixture(page: Page, fixture: MobilityVisualPage["fixture"]) {
  await page.unroute("**/v1/internal-sandbox/app/synthetic-trips/dashboard");
  if (fixture === "driver-orders") {
    await mockMobilityDashboard(page, {
      availableDriverTrips: [
        syntheticTrip("paid_pending_match", "driver-offer-1", 1, visualFixtureTime),
      ],
    });
    return;
  }
  if (fixture === "driver-pickup") {
    await mockMobilityDashboard(page, {
      activeDriverTrip: syntheticTrip("accepted", "driver-active-pickup", 2, visualFixtureTime),
    });
    return;
  }
  if (fixture === "driver-waiting") {
    await mockMobilityDashboard(page, {
      activeDriverTrip: syntheticTrip(
        "driver_arrived",
        "driver-active-waiting",
        2,
        visualFixtureTime,
      ),
    });
    return;
  }
  if (fixture === "driver-active") {
    await mockMobilityDashboard(page, {
      activeDriverTrip: syntheticTrip("in_progress", "driver-active-trip", 2, visualFixtureTime),
    });
    return;
  }
  if (fixture === "driver-completion") {
    await mockMobilityDashboard(page, {
      reservedDriverTrips: [
        syntheticTrip("completed", "driver-completed-trip", 2, visualFixtureTime),
      ],
    });
    return;
  }
  if (fixture === "driver-history") {
    await mockMobilityDashboard(page, {
      reservedDriverTrips: [
        syntheticTrip("completed", "driver-history-completed", 2, visualFixtureTime),
        syntheticTrip("cancelled", "driver-history-cancelled", 2, visualFixtureTime),
      ],
    });
    return;
  }
  await mockMobilityDashboard(page);
}

async function setSharedFixture(page: Page, fixture: MobilityVisualPage["fixture"]) {
  await page.unroute("**/v1/internal-sandbox/app/synthetic-trips/dashboard");
  await page.unroute("**/v1/internal-sandbox/app/synthetic-trips/*/chat");
  await page.unroute("**/v1/internal-sandbox/app/messages");

  if (fixture === "shared-trip-chat") {
    const trip = {
      ...syntheticTrip(
        "accepted",
        "shared-visual-trip",
        1,
        visualFixtureTime,
      ),
      passengerAccountId: "synthetic-account-7",
      driverAccountId: "shared-visual-driver",
      passengerProfile: {
        accountId: "synthetic-account-7",
        displayName: "林女士",
        avatarUrl: "https://example.invalid/rider.png",
        gender: "female" as const,
        genderSource: "verified_identity_document" as const,
        genderDisclosure: "eligible_driver_pre_acceptance" as const,
        rating: { average: 4.8, ratingCount: 36 },
        synthetic: true as const,
      },
      driverProfile: {
        accountId: "shared-visual-driver",
        displayName: "周师傅",
        avatarUrl: "https://example.invalid/driver.png",
        gender: "male" as const,
        genderSource: "verified_identity_document" as const,
        genderDisclosure: "matched_passenger_post_acceptance" as const,
        rating: { average: 4.9, ratingCount: 128 },
        synthetic: true as const,
      },
    };
    await mockMobilityDashboard(page, { passengerTrip: trip });
    await page.route(
      `**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversationId: `trip-chat-${trip.tripId}`,
            tripId: trip.tripId,
            state: "open",
            participants: [trip.passengerProfile, trip.driverProfile],
            messages: [
              {
                messageId: "shared-chat-1",
                senderAccountId: "shared-visual-driver",
                body: "您好，我正在西藏中路路口。",
                sentAt: "2026-07-15T01:40:00.000Z",
                deliveryState: "sent",
                synthetic: true,
              },
              {
                messageId: "shared-chat-2",
                senderAccountId: "synthetic-account-7",
                body: "好的，我在 2 号门等您。",
                sentAt: "2026-07-15T01:40:30.000Z",
                deliveryState: "sent",
                synthetic: true,
              },
            ],
            quickReplies: ["我马上到", "请稍等", "我在上车点"],
            openedAt: "2026-07-15T01:39:00.000Z",
            expiresAt: "2026-07-15T03:41:00.000Z",
            retention: {
              evidenceHold: false,
              deletionState: "not_due",
              summaryRetained: true,
            },
            realChatEnabled: false,
            externalChatProviderEnabled: false,
            synthetic: true,
          }),
        });
      },
    );
    return;
  }

  if (fixture === "shared-message-center") {
    const trip = syntheticTrip(
      "accepted",
      "shared-message-trip",
      1,
      visualFixtureTime,
    );
    await mockMobilityDashboard(page, { passengerTrip: trip });
    await page.route(
      `**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversationId: `trip-chat-${trip.tripId}`,
            tripId: trip.tripId,
            state: "open",
            participants: [trip.passengerProfile, trip.driverProfile],
            messages: [
              {
                messageId: "shared-message-chat-1",
                senderAccountId: trip.driverAccountId,
                body: "您好，我正在西藏中路路口。",
                sentAt: "2026-07-15T01:38:00.000Z",
                deliveryState: "sent",
                synthetic: true,
              },
              {
                messageId: "shared-message-chat-2",
                senderAccountId: "current-session-account",
                body: "好的，我在人民广场东门等候。",
                sentAt: "2026-07-15T01:40:00.000Z",
                deliveryState: "sent",
                synthetic: true,
              },
            ],
            quickReplies: ["我马上到"],
            openedAt: "2026-07-15T01:35:00.000Z",
            expiresAt: "2026-07-20T01:35:00.000Z",
            retention: {
              contentDeleteAfter: "2026-07-23T01:35:00.000Z",
              evidenceHold: false,
              deletionState: "blocked_by_window",
              summaryRetained: true,
            },
            realChatEnabled: false,
            externalChatProviderEnabled: false,
            synthetic: true,
          }),
        });
      },
    );
    await page.route("**/v1/internal-sandbox/app/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              itemId: "shared-message-chat",
              category: "trip_chat",
              title: "周师傅",
              body: "我正在西藏中路路口。",
              occurredAt: "2026-07-15T01:40:00.000Z",
              pinned: true,
              target: { kind: "trip_chat", tripId: "shared-message-trip" },
              synthetic: true,
            },
            {
              itemId: "shared-message-trip-service",
              category: "trip_service",
              title: "行程通知",
              body: "车主已接单，约 5 分钟到达。",
              occurredAt: "2026-07-15T01:37:00.000Z",
              pinned: false,
              target: { kind: "trip", tripId: "shared-message-trip" },
              synthetic: true,
            },
            {
              itemId: "shared-message-vehicle",
              category: "vehicle_review",
              title: "车辆审核",
              body: "你的车辆资料审核已通过。",
              occurredAt: "2026-07-14T01:41:00.000Z",
              readAt: "2026-07-14T02:00:00.000Z",
              pinned: false,
              target: { kind: "vehicle_review", reviewId: "vehicle-application-7" },
              synthetic: true,
            },
          ],
          unreadCount: 2,
          realPushEnabled: false,
          externalNotificationProviderEnabled: false,
          synthetic: true,
        }),
      });
    });
    return;
  }

  await mockMobilityDashboard(page);
}
