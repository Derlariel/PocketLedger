import { test, expect } from "@playwright/test";

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD against a disposable Supabase project");

test("sign in, create account, post expense, upload evidence and inspect audit", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("อีเมล").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("รหัสผ่าน").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("link", { name: "บัญชี" }).first().click();
  await page.getByLabel("ชื่อบัญชี").fill(`E2E ${Date.now()}`);
  await page.getByRole("button", { name: "เพิ่มบัญชี" }).click();
  await expect(page.getByText("เพิ่มบัญชีแล้ว")).toBeVisible();

  await page.goto("/transactions/new");
  await page.getByLabel("จำนวนเงิน (บาท)").fill("125.50");
  await page.getByLabel("รายละเอียด / ร้านค้า").fill("E2E coffee");
  await page.getByRole("button", { name: "ยืนยันรายการ" }).click();
  await expect(page).toHaveURL(/transactions\/[0-9a-f-]+/);
  await expect(page.getByText("฿125.50")).toBeVisible();

  await page.goto("/upload");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByText("เก็บไฟล์แล้ว")).toBeVisible();

  await page.goto("/activity");
  await expect(page.getByText("transactions").first()).toBeVisible();
});
