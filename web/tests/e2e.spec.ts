import { test, expect, Page, Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setupMocks(page: Page) {
  page.on("request", request => console.log(">> REQUEST:", request.method(), request.url(), request.postData()));
  page.on("response", response => console.log("<< RESPONSE:", response.status(), response.url()));

  // Mock Firebase Auth REST endpoints
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts/, async (route: Route) => {
    const url = route.request().url();
    if (url.includes("signUp")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#SignupNewUserResponse",
          idToken: "mock-id-token-xyz",
          refreshToken: "mock-refresh-token-xyz",
          expiresIn: "3600",
          localId: "mock-local-id-xyz",
        }),
      });
    } else if (url.includes("signInWithPassword")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#VerifyPasswordResponse",
          idToken: "mock-id-token-xyz",
          refreshToken: "mock-refresh-token-xyz",
          expiresIn: "3600",
          localId: "mock-local-id-xyz",
        }),
      });
    } else if (url.includes("update")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#SetAccountInfoResponse",
          idToken: "mock-id-token-xyz",
          refreshToken: "mock-refresh-token-xyz",
          expiresIn: "3600",
          localId: "mock-local-id-xyz",
        }),
      });
    } else if (url.includes("lookup")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#GetAccountInfoResponse",
          users: [{ localId: "mock-local-id-xyz", email: "mock-user@example.com", emailVerified: false }]
        })
      });
    } else {
      await route.fallback();
    }
  });

  await page.route(/securetoken\.googleapis\.com\/v1\/token/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        expires_in: "3600",
        token_type: "Bearer",
        refresh_token: "mock-refresh-token-xyz",
        id_token: "mock-id-token-xyz",
        access_token: "mock-id-token-xyz",
        user_id: "mock-local-id-xyz",
        project_id: "handprint-498816",
      }),
    });
  });

  // Mock Backend REST endpoints
  await page.route("**/trips/parse", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        origin: "Delhi",
        destination: "Noida",
        mode: "ev_car"
      }),
    });
  });

  await page.route("**/trips/distance**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        distance_km: 50.0
      }),
    });
  });

  await page.route("**/trips/simulate", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scenario: "mode_shift",
        base_annual_co2e_kg: 2400.0,
        projected_annual_co2e_kg: 1200.0,
        annual_savings_co2e_kg: 1200.0,
        percentage_reduction: 50.0
      }),
    });
  });

  await page.route("**/trips", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-trip-id",
          origin: "Delhi",
          destination: "Noida",
          distance_km: 50.0,
          mode: "ev_car",
          co2e_kg: 2.34
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-trip-id-1",
            origin: "Delhi",
            destination: "Noida",
            distance_km: 50.0,
            mode: "ev_car",
            co2e_kg: 2.34,
            timestamp: "2026-06-09T12:00:00Z"
          }
        ]),
      });
    }
  });

  await page.route("**/committed_actions/*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-commitment-id",
        action_key: "mode_shift_12345",
        title: "Shift 50% of private trips to bicycle",
        category: "transport",
        projected_savings_kg: 1200.0,
        status: "completed"
      }),
    });
  });

  await page.route("**/committed_actions", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-commitment-id",
          action_key: "mode_shift_12345",
          title: "Shift 50% of private trips to bicycle",
          category: "transport",
          projected_savings_kg: 1200.0,
          status: "active"
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-commitment-id",
            action_key: "mode_shift_12345",
            title: "Shift 50% of private trips to bicycle",
            category: "transport",
            projected_savings_kg: 1200.0,
            status: "active"
          }
        ]),
      });
    }
  });

  await page.route("**/streaks", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        streak_days: 3,
        last_active_date: "2026-06-09",
        longest_streak: 5
      }),
    });
  });

  await page.route("**/food", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-food-id",
          item: "rice",
          weight_kg: 0.50,
          co2e_kg: 2.225
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-food-id-1",
            item: "rice",
            weight_kg: 0.50,
            co2e_kg: 2.225,
            timestamp: "2026-06-09T12:00:00Z"
          }
        ]),
      });
    }
  });

  await page.route("**/energy", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-energy-id",
          source: "electricity",
          quantity: 100.0,
          co2e_kg: 72.7
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-energy-id-1",
            source: "electricity",
            quantity: 100.0,
            co2e_kg: 72.7,
            timestamp: "2026-06-09T12:00:00Z"
          }
        ]),
      });
    }
  });

  await page.route("**/insights", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        narration: "You are doing great! Your transport emissions are below IPCC sustainable limits.",
        source: "gemini"
      }),
    });
  });
}

test.describe("Handprint E2E", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("dashboard renders correctly and has no a11y violations", async ({ page }) => {
    await page.goto("/");
    // Wait for the main page loaded content to be visible (e.g. Daily Carbon Budget heading)
    await expect(page.locator("text=Daily Carbon Budget")).toBeVisible();
    
    // Verify skip to main content link exists
    const skipLink = page.locator("text=Skip to main content");
    await expect(skipLink).toBeAttached();

    // Verify climate benchmarks comparison card
    await expect(page.locator("text=Climate Benchmarks")).toBeVisible();

    // Verify SVG trend table fallback is present
    const trendTable = page.locator("table.sr-only");
    await expect(trendTable).toBeAttached();

    // Run axe accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("manual trip log and secondary categories log", async ({ page }) => {
    await page.goto("/trips/new");
    await expect(page.locator("text=Log Travel Trip")).toBeVisible();

    // Verify label associations and fill form
    await page.fill("#origin-input", "Delhi");
    await page.fill("#destination-input", "Noida");
    await page.click("#mode-radio-ev_car");

    // Click calculate
    await page.click("text=Calculate Distance & Carbon");

    // Preview should show up
    await expect(page.locator("text=Emissions Preview").or(page.locator("text=Accounting Methodology"))).toBeVisible();
    
    // Click Save
    await page.click("text=Save Trip Log");

    // Redirect to dashboard (with mocked route showing budget)
    await expect(page).toHaveURL("/");

    // Go back to test Food
    await page.goto("/trips/new");
    await page.click("#tab-food");
    await expect(page.locator("text=Select Food Item")).toBeVisible();

    await page.click("#food-radio-rice");
    await page.fill("#food-weight-input", "0.50");
    await page.click("text=Save Food Log");
    await expect(page).toHaveURL("/");

    // Go back to test Energy
    await page.goto("/trips/new");
    await page.click("#tab-energy");
    await expect(page.locator("text=Select Utility Source")).toBeVisible();

    await page.click("#energy-radio-electricity");
    await page.fill("#energy-quantity-input", "100");
    await page.click("text=Save Energy Log");
    await expect(page).toHaveURL("/");

    // Scan for WCAG violations
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("NL trip log with AI Journey Autofill", async ({ page }) => {
    await page.goto("/trips/new");
    await expect(page.locator("text=AI Journey Autofill")).toBeVisible();

    await page.fill("#ai-text-input", "Drove 50km from Delhi to Noida in an EV");
    await page.click("#ai-autofill-button");

    // Assert inputs populated
    await expect(page.locator("#origin-input")).toHaveValue("Delhi");
    await expect(page.locator("#destination-input")).toHaveValue("Noida");

    // Scan accessibility
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("run a what-if simulation and pledge committed action", async ({ page }) => {
    await page.goto("/simulate");
    await expect(page.locator("text=Configure Scenario")).toBeVisible();

    // Strategy selection
    await page.click("#sc-radio-mode_shift");
    await page.click("#target-mode-radio-bicycle");

    // Target alternate mode
    await page.fill("#percentage-slider", "50");
    await page.click("text=Calculate Projected Savings");

    // Results gauge and equivalent cards should show up
    await expect(page.locator("text=Simulation Forecast Analysis")).toBeVisible();
    await expect(page.locator("text=Trees Grown")).toBeVisible();

    // Commit pledge
    await page.click("text=Pledge and Commit to this Action");
    await expect(page.locator("text=Emissions Pledged Successfully!")).toBeVisible();

    // Verify progressbar has accessible role and values
    const progressGauge = page.locator("[role='progressbar']");
    await expect(progressGauge).toBeVisible();
    await expect(progressGauge).toHaveAttribute("aria-valuenow", "50");

    // Scan accessibility
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("auth upgrade flow page rendering and check", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Save your progress")).toBeVisible();

    await page.fill("#login-email", "newuser@example.com");
    await page.fill("#login-password", "supersecretpassword");
    await page.fill("#login-confirm-password", "supersecretpassword");

    // Trigger mock accounts upgrade or check elements
    const saveButton = page.locator("text=Save My Account");
    await expect(saveButton).toBeVisible();

    // Scan accessibility
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
