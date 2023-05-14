const { test, expect } = require("@playwright/test");

test("load module are all correct", async ({ page }) => {
  await page.goto("http://localhost:3340/test/statics/load-module.html");

  await new Promise((res) => setTimeout(res, 1000));

  await expect((await page.$$(".jasmine-specs .jasmine-passed")).length).toBe(
    4
  );
});

test("use", async ({ page }) => {
  await page.goto("http://localhost:3340/test/statics/use.html");

  const { _preview: p1 } = await page.waitForFunction(async () => {
    return JSON.stringify(uses);
  });

  const data1 = JSON.parse(p1);

  await expect(data1.length).toBe(2);

  await page.waitForFunction(async () => {
    document.querySelector("#target-lm").removeAttribute("pause");
  });

  const { _preview: p2 } = await page.waitForFunction(async () => {
    return JSON.stringify(uses);
  });

  const data2 = JSON.parse(p2);

  await expect(data2.length).toBe(3);
});
