import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "../../../web/packages/studio/node_modules/@playwright/test/index.mjs";

const outputDirectory = fileURLToPath(new URL("./assets/", import.meta.url));
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  `,
});

const capture = async (name, scene, readyText) => {
  await page.goto(`http://127.0.0.1:4178/?scene=${scene}`, {
    waitUntil: "networkidle",
  });
  if (readyText) await page.getByText(readyText, { exact: false }).first().waitFor();
  await page.screenshot({ path: `${outputDirectory}/${name}.png` });
};

await capture("01-intro", "intro", "Zoomer");
await capture("02-compare", "compare", "Same evidence");
await capture("03-hierarchy", "hierarchy", "Semantic map");

await page.getByRole("button", { name: "Collapse Narrow the retry boundary" }).click();
await page.getByRole("button", { name: "Collapse Verify behavior and full-suite safety" }).click();
await page.screenshot({ path: `${outputDirectory}/04-mixed-detail.png` });

await page.getByRole("button", { name: "Ask Zoomer about Diagnose the flaky failure" }).click();
await page.getByText("Why did the first test attempt fail?", { exact: true }).waitFor();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outputDirectory}/05-question.png` });

await capture("06-progress", "progress", "68%");
await capture("07-extension", "extension", "Four fields");
await capture("08-code", "code", "traceViews");
await capture("09-closing", "closing", "Understand the run");

await browser.close();
