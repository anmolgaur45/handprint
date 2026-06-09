import { test, expect, Page, Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setupMocks(page: Page) {
  // Firebase Auth
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
          users: [{ localId: "mock-local-id-xyz", email: "mock-user@example.com", emailVerified: false }],
        }),
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

  // Backend: trips/parse must be registered before trips to avoid glob collision
  await page.route("**/trips/parse", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ origin: "Delhi", destination: "Noida", mode: "ev_car" }),
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
        percentage_reduction: 50.0,
      }),
    });
  });

  await page.route("**/trips", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-trip-id",
          user_id: "mock-local-id-xyz",
          origin: "",
          destination: "",
          distance_km: 50.0,
          mode: "ev_car",
          co2e_kg: 2.345,
          citation: "UK DESNZ/DEFRA GHG Conversion Factors",
          effective_year: 2024,
          timestamp: "2026-06-10T12:00:00Z",
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-trip-id-1",
            user_id: "mock-local-id-xyz",
            origin: "",
            destination: "",
            distance_km: 50.0,
            mode: "ev_car",
            co2e_kg: 2.345,
            citation: "UK DESNZ/DEFRA GHG Conversion Factors",
            effective_year: 2024,
            timestamp: "2026-06-10T12:00:00Z",
          },
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
        status: "completed",
      }),
    });
  });

  await page.route("**/committed_actions", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-commitment-id",
          action_key: "mode_shift_12345",
          title: "Shift 50% of private trips to bicycle",
          category: "transport",
          projected_savings_kg: 1200.0,
          status: "active",
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
            status: "active",
          },
        ]),
      });
    }
  });

  await page.route("**/streaks", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: "mock-local-id-xyz",
        current_streak: 3,
        longest_streak: 5,
        last_active_at: "2026-06-10T12:00:00Z",
      }),
    });
  });

  await page.route("**/food", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-food-id",
          user_id: "mock-local-id-xyz",
          item: "rice",
          weight_kg: 0.5,
          co2e_kg: 2.225,
          citation: "Poore & Nemecek (2018) via Our World in Data",
          effective_year: 2018,
          timestamp: "2026-06-10T12:00:00Z",
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-food-id-1",
            user_id: "mock-local-id-xyz",
            item: "rice",
            weight_kg: 0.5,
            co2e_kg: 2.225,
            citation: "Poore & Nemecek (2018) via Our World in Data",
            effective_year: 2018,
            timestamp: "2026-06-10T12:00:00Z",
          },
        ]),
      });
    }
  });

  await page.route("**/energy", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-energy-id",
          user_id: "mock-local-id-xyz",
          source: "electricity",
          quantity: 100.0,
          co2e_kg: 72.7,
          citation: "CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0",
          effective_year: 2024,
          timestamp: "2026-06-10T12:00:00Z",
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "mock-energy-id-1",
            user_id: "mock-local-id-xyz",
            source: "electricity",
            quantity: 100.0,
            co2e_kg: 72.7,
            citation: "CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0",
            effective_year: 2024,
            timestamp: "2026-06-10T12:00:00Z",
          },
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
        source: "gemini",
      }),
    });
  });
}

test.describe("Handprint E2E", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("dashboard renders correctly and has no a11y violations", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Daily Carbon Budget")).toBeVisible();

    const skipLink = page.locator("text=Skip to main content");
    await expect(skipLink).toBeAttached();

    await expect(page.locator("text=Climate Benchmarks")).toBeVisible();

    const trendTable = page.locator("table.sr-only");
    await expect(trendTable).toBeAttached();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("log activity page renders with correct heading and all tabs", async ({ page }) => {
    await page.goto("/trips/new");

    await expect(page.locator("h1")).toHaveText("Log an activity");

    // All three tab buttons present with correct IDs
    await expect(page.locator("#tab-travel")).toBeVisible();
    await expect(page.locator("#tab-food")).toBeVisible();
    await expect(page.locator("#tab-energy")).toBeVisible();

    // Travel panel is active by default — real form fields visible
    await expect(page.locator("#travel-mode")).toBeVisible();
    await expect(page.locator("#travel-km")).toBeVisible();
  });

  test("log travel activity and see inline success message", async ({ page }) => {
    await page.goto("/trips/new");

    // Travel tab is default — select ev_car mode
    await page.selectOption("#travel-mode", "ev_car");

    // Enter distance using the real input ID
    await page.fill("#travel-km", "50");

    // Submit via the "Add to log" button (type=submit inside the travel panel form)
    await page.click('#panel-travel button[type="submit"]');

    // Success banner shown inline — no redirect
    await expect(page.locator("text=Activity logged successfully.")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("log food activity and see inline success message", async ({ page }) => {
    await page.goto("/trips/new");

    // Switch to food tab using real ID
    await page.click("#tab-food");
    await expect(page.locator("#food-item")).toBeVisible();
    await expect(page.locator("#food-weight")).toBeVisible();

    // Select rice from the food-item dropdown
    await page.selectOption("#food-item", "rice");

    // Enter weight using the real input ID
    await page.fill("#food-weight", "0.5");

    // Submit
    await page.click('#panel-food button[type="submit"]');

    await expect(page.locator("text=Activity logged successfully.")).toBeVisible();
  });

  test("log energy activity and see inline success message", async ({ page }) => {
    await page.goto("/trips/new");

    // Switch to energy tab using real ID
    await page.click("#tab-energy");
    await expect(page.locator("#energy-source")).toBeVisible();
    await expect(page.locator("#energy-qty")).toBeVisible();

    // Select electricity from the energy-source dropdown
    await page.selectOption("#energy-source", "electricity");

    // Enter quantity using the real input ID
    await page.fill("#energy-qty", "100");

    // Submit
    await page.click('#panel-energy button[type="submit"]');

    await expect(page.locator("text=Activity logged successfully.")).toBeVisible();
  });

  test("AI autofill toggle expands panel and parses mode from text", async ({ page }) => {
    await page.goto("/trips/new");

    // The AI autofill toggle button is visible on the travel tab
    const aiToggle = page.locator('button:has-text("AI autofill")');
    await expect(aiToggle).toBeVisible();

    // Expand the AI panel
    await aiToggle.click();

    // Real input IDs are now visible
    await expect(page.locator("#ai-text-input")).toBeVisible();
    await expect(page.locator("#ai-autofill-button")).toBeVisible();

    // Type journey description and click Parse
    await page.fill("#ai-text-input", "Drove 50km from Delhi to Noida in an EV");
    await page.click("#ai-autofill-button");

    // Mock returns mode=ev_car; the travel-mode select should reflect it
    await expect(page.locator("#travel-mode")).toHaveValue("ev_car");

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("run a what-if simulation and pledge committed action", async ({ page }) => {
    await page.goto("/simulate");
    await expect(page.locator("text=Configure Scenario")).toBeVisible();

    await page.click("#sc-radio-mode_shift");
    await page.click("#target-mode-radio-bicycle");

    await page.fill("#percentage-slider", "50");
    await page.click("text=Calculate Projected Savings");

    await expect(page.locator("h2:has-text('Simulation Results')")).toBeVisible();
    await expect(page.locator("text=Trees grown")).toBeVisible();

    await page.click("text=Pledge this reduction");
    await expect(page.locator("text=Commitment saved.")).toBeVisible();

    const progressGauge = page.locator("[role='progressbar']");
    await expect(progressGauge).toBeVisible();
    await expect(progressGauge).toHaveAttribute("aria-valuenow", "50");

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("auth upgrade flow page rendering and check", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Save your progress")).toBeVisible();

    await page.fill("#login-email", "newuser@example.com");
    await page.fill("#login-password", "supersecretpassword");
    await page.fill("#login-confirm-password", "supersecretpassword");

    const saveButton = page.locator("text=Save My Account");
    await expect(saveButton).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
