import { expect, test, useAssistantAdapter, useAuthAdapterScenario } from './fixtures';

const PHONE_WIDTHS = [320, 375, 390, 393] as const;

// 인증 폼이 폰 폭에서 가로로 넘치면(입력 고유 폭이 grid auto 트랙을 밀어냄) 카드 테두리가 잘린다.
for (const width of PHONE_WIDTHS) {
  for (const route of ['/auth/login', '/auth/signup'] as const) {
    test(`${route} has no horizontal overflow at ${width}px`, async ({ page }) => {
      await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
      await page.setViewportSize({ width, height: 812 });
      await page.goto(route);
      const form = page.locator('[data-auth-form]');
      await expect(form).toBeVisible();
      // 웹폰트가 적용된 뒤 입력의 고유 폭이 확정된다. 폰트 로드 전 측정하면 넘침을 놓친다.
      await page.evaluate(() => document.fonts.ready);

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const card = document.querySelector('[data-auth-form]')!.getBoundingClientRect();
        const maxRight = Math.max(
          ...Array.from(document.querySelectorAll('[data-auth-surface] *')).map(
            (element) => element.getBoundingClientRect().right,
          ),
        );
        return {
          overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
          cardRight: card.right,
          maxRight,
          viewport: root.clientWidth,
        };
      });
      expect(metrics.overflow).toBe(0);
      // 카드 우측 테두리와 모든 자손이 뷰포트 안에 있어야 한다(잘림 방지).
      expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewport - 1);
      expect(metrics.maxRight).toBeLessThanOrEqual(metrics.viewport);
    });
  }
}

test('auth switch links keep a 44px touch target', async ({ page }) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  for (const [route, name] of [
    ['/auth/login', '회원가입'],
    ['/auth/signup', '로그인'],
  ] as const) {
    await page.goto(route);
    const box = await page
      .locator('[data-auth-form-mode] > p a')
      .filter({ hasText: name })
      .boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('assistant question survives 1-pane to 2-pane rotation', async ({ page }) => {
  await useAssistantAdapter(page);
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();
  const input = page.locator('[data-assistant-question]');
  await input.fill('회전해도 남아야 하는 질문');

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'two-pane',
  );
  await expect(page.locator('[data-assistant-question]')).toHaveValue('회전해도 남아야 하는 질문');

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'single',
  );
  await expect(page.locator('[data-assistant-question]')).toHaveValue('회전해도 남아야 하는 질문');
});
