import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const seriousOrCritical = (violations: { impact?: string | null }[]) =>
  violations.filter(item => item.impact === 'serious' || item.impact === 'critical')

test.describe('KING-FUN responsive experience', () => {
  test('renders the complete 27-game library and navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /king-fun/i })).toBeVisible()
    await expect(page.locator('.game-card-v2')).toHaveCount(27)
    await expect(page.locator('.game-card-v2:has(#game-title-imposter)')).toBeVisible()
    await expect(page.locator('.game-card-v2:has(#game-title-reverse-singing)')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })

  test('every added game launches into a real controller with valid player constraints', async ({ page }) => {
    test.setTimeout(300_000)
    const games = [
      { name: 'Timer Impostor', players: 3 },
      { name: 'Werewolf', players: 5 },
      { name: 'Mafia', players: 5 },
      { name: 'Murder', players: 3 },
      { name: 'Fake It', players: 3 },
      { name: 'Fake Story', players: 3 },
      { name: 'Fact or Fiction', players: 3 },
      { name: 'Wrong Answers Only', players: 3 },
      { name: 'Hot Bomb', players: 3 },
      { name: 'Hot Bomb Duel', players: 2 },
      { name: "Who's Most Likely", players: 3 },
      { name: 'Would You Rather', players: 3 },
      { name: 'Share or Pass', players: 3 },
      { name: '$20 Challenge', players: 3 },
      { name: 'Tilt It', players: 3 },
      { name: 'Letterburg', players: 3 },
      { name: 'Discussion Starter', players: 3 },
      { name: 'Who Am I?', players: 3 },
      { name: 'Ten Tangle', players: 3 },
      { name: 'Qupid', players: 2 },
      { name: 'Questions for Love', players: 2 },
      { name: 'A or B', players: 2 },
      { name: 'Reverse Singing', players: 3 },
    ]

    for (const [index, game] of games.entries()) {
      await page.goto('/')
      const gameCard = page.locator('.game-card-v2').filter({ has: page.getByRole('heading', { name: game.name, exact: true }) })
      await gameCard.click()
      await expect(page.locator('.setup-workspace')).toBeVisible({ timeout: 10_000 })
      const chips = page.locator('.player-chip-editable')
      // The setup screen is intentionally delayed for the home-to-setup
      // transition. Wait for the persisted roster before taking an immediate
      // count snapshot; otherwise the first read can observe the old home DOM.
      await expect(chips.first()).toBeVisible({ timeout: 10_000 })
      let count = await chips.count()
      while (count > game.players) {
        await chips.nth(count - 1).getByRole('button', { name: /^Remove / }).click()
        await expect(chips).toHaveCount(count - 1)
        count = await chips.count()
      }
      while (count < game.players) {
        const input = page.getByRole('textbox', { name: 'New player name' })
        await input.fill(`Arcade ${index} Player ${count + 1}`)
        const addPlayer = page.getByRole('button', { name: /add player/i })
        await expect(addPlayer, `${game.name} should allow adding player ${count + 1}`).toBeEnabled()
        await addPlayer.click()
        await expect(chips).toHaveCount(count + 1)
        count = await chips.count()
      }
      await expect(page.getByRole('button', { name: /^Start game/i }).first()).toBeEnabled()
      await page.getByRole('button', { name: /^Start game/i }).first().click()
      const loadingOverlay = page.locator('.game-loading-layer')
      await expect(loadingOverlay, `${game.name} should display the shared startup overlay`).toBeVisible({ timeout: 3_000 })
      await expect(loadingOverlay).toHaveAttribute('aria-label', `Starting ${game.name}`)
      if (game.name === 'Timer Impostor') {
        await expect(loadingOverlay).not.toContainText(/Generating with (Gemini|Groq|Cloudflare)/)
      }
      await expect(page.locator('.party-stage')).toBeVisible({ timeout: 8_000 })
      await expect(page.locator('.party-stage h1, .party-stage h2').first()).toBeVisible()
    }
  })

  test('the 12-column game grid reflows without horizontal overflow across breakpoints', async ({ page }) => {
    await page.goto('/')
    const gameGrid = page.locator('.game-grid-v2')
    const gameCards = gameGrid.locator('.game-card-v2')
    await expect(gameGrid).toBeVisible()
    await expect(gameCards).toHaveCount(27)
    for (const width of [320, 360, 390, 620, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      // Re-resolve the same live grid after each resize rather than querying
      // the document separately during a possible React/layout commit.
      await expect(gameGrid).toBeVisible()
      await expect(gameCards).toHaveCount(27)
      await expect(gameGrid).toHaveCSS('display', 'grid')
      await expect(page.locator('.topbar-inner')).toBeVisible()
      const layout = await gameGrid.evaluate(grid => {
        const cards = [...grid.querySelectorAll<HTMLElement>('.game-card-v2')]
        const tracks = getComputedStyle(grid).gridTemplateColumns.trim()
        return {
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          columns: tracks ? tracks.split(/\s+/).length : 0,
          cardRects: cards.map(card => ({ left: card.getBoundingClientRect().left, right: card.getBoundingClientRect().right })),
          cardOverflow: cards.map(card => getComputedStyle(card).overflow),
        }
      })
      expect(layout.document, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(layout.viewport)
      expect(layout.columns, `grid missing at ${width}px`).toBeGreaterThanOrEqual(1)
      expect(layout.cardRects).toHaveLength(27)
      expect(layout.cardRects.every(rect => rect.left >= 0 && rect.right <= width + 1), `card outside viewport at ${width}px`).toBe(true)
      expect(layout.cardOverflow.every(value => value === 'hidden'), `decorative art escapes card bounds at ${width}px`).toBe(true)
    }
  })


  test('Fake It privately reveals a word, runs a yes/no round and accepts individual guesses', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Fake It/ }).click()
    await page.getByRole('button', { name: /^Start game/i }).click()
    await expect(page.getByRole('heading', { name: /pass the device to/i })).toBeVisible()
    await page.getByRole('button', { name: 'Reveal secret word' }).click()
    await expect(page.locator('.identity-card')).toBeVisible()
    await page.getByRole('button', { name: /hide word.*start questions/i }).click()
    await expect(page.getByRole('heading', { name: /question the word-holder/i })).toBeVisible()
    await page.getByRole('button', { name: /start guesses/i }).click()
    await expect(page.getByRole('textbox', { name: 'Your guess' })).toBeVisible()
    await expect(page.getByRole('button', { name: /pass this guess/i })).toBeVisible()
  })

  test('Would You Rather supports a multi-prompt session without replaying a round', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Would You Rather/i }).click()
    await page.getByRole('button', { name: /^Start game/i }).click()
    await expect(page.getByRole('heading', { name: /your preference/i })).toBeVisible()
    const firstPrompt = await page.locator('.party-stage-heading p').textContent()
    const voterLabel = await page.locator('.party-progress-note').textContent()
    const voterCount = Number(voterLabel?.match(/OF\s+(\d+)/i)?.[1] ?? 0)
    expect(voterCount).toBeGreaterThan(1)
    for (let vote = 0; vote < voterCount; vote += 1) {
      await page.locator('.party-option').first().click()
      await page.getByRole('button', { name: /submit private vote/i }).click()
    }
    await expect(page.getByRole('heading', { name: /picked a side/i })).toBeVisible()
    await page.getByRole('button', { name: /next prompt/i }).click()
    await expect(page.getByRole('heading', { name: /your preference/i })).toBeVisible()
    await expect(page.locator('.party-stage-heading p')).not.toHaveText(firstPrompt ?? '')
  })

  test('I Have Never shows live startup progress until its opening statement is ready', async ({ page }) => {
    await page.route('**/v1/content/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked: [] }) }))
    await page.route('**/v1/content/generate', async route => {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requestId: requestBody.requestId,
          provider: 'cloudflare-workers-ai',
          cacheHit: false,
          items: [{
            id: 'e2e-never-have-i-ever-opening',
            text: 'Never have I ever missed a train.',
            categoryId: requestBody.categoryId,
            kind: 'statement',
            locale: 'en',
            suitability: 'general',
          }],
        }),
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: /I Have Never/i }).click()
    // Spin-wheel mode deliberately waits until a player has been selected
    // before drawing their private prompt. Choose one-at-a-time to exercise
    // the initial-prompt-during-startup path tested below.
    const oneAtATime = page.getByRole('button', { name: /One at a time/i })
    await oneAtATime.click()
    await expect(oneAtATime).toHaveAttribute('aria-pressed', 'true')
    const generationRequest = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().includes('/v1/content/generate'),
      { timeout: 10_000 },
    )
    await page.getByRole('button', { name: /^Start game/i }).click()
    const loadingOverlay = page.locator('.game-loading-layer')
    await expect(loadingOverlay).toBeVisible({ timeout: 3_000 })
    await generationRequest
    await expect(loadingOverlay).toContainText('Opening statement ready', { timeout: 8_000 })
    await expect(page.getByRole('heading', { name: /statement 1/i })).toBeVisible({ timeout: 8_000 })
  })

  test('Who Am I keeps the forehead identity visible during yes/no play', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Who Am I/i }).click()
    await page.getByRole('button', { name: /^Start game/i }).click()
    await expect(page.getByRole('heading', { name: /who are you/i })).toBeVisible()
    await expect(page.getByText(/show this identity to the group/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /they guessed it/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /pass identity/i })).toBeVisible()
  })

  test('setup uses a responsive 12-column workspace and validates player input', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Imposter/ }).click()
    await expect(page.getByRole('heading', { name: /set up imposter/i })).toBeVisible({ timeout: 10_000 })
    const setupGrid = page.locator('.setup-layout')
    await expect(setupGrid).toBeVisible()
    expect(await setupGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(12)

    const playerInput = page.getByRole('textbox', { name: 'New player name' })
    await playerInput.fill('Taylor')
    await page.getByRole('button', { name: /add player/i }).click()
    await expect(page.locator('.player-chip-name', { hasText: 'Taylor' })).toBeVisible()

    await playerInput.fill('')
    await page.getByRole('button', { name: /add player/i }).click()
    await expect(page.getByRole('alert')).toContainText('Enter a player name')
  })

  test('Imposter role card begins revealing immediately on press and hides on release', async ({ page }) => {
    // Built-in categories intentionally have no bundled/offline word bank. Keep
    // this UI regression deterministic by stubbing the ordered LLM gateway with
    // a schema-valid response; the test is about the private reveal interaction,
    // not whether a live provider or deployed backend is available.
    const generatedWords = ['Lantern']
    const wordHints = [
      'a recognisable physical form', 'it can have different sizes', 'people may use it regularly',
      'it can be made from different materials', 'it may be stored indoors', 'it has a familiar purpose',
      'it can have a distinctive shape', 'it may be found in many places', 'it can be described by colour',
      'it may be new or old', 'it can be part of a collection', 'it can be carried by a person',
      'it may have a particular design', 'it can be seen and touched', 'it may be bought in a shop',
      'it can be useful in everyday life', 'it may be kept in a home', 'it has recognisable features',
      'it can be made in several styles', 'it is a concrete thing rather than an idea',
    ]
    let generationRequest: Record<string, unknown> | undefined
    await page.route('**/v1/content/generate', async route => {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>
      generationRequest = requestBody
      const categoryId = String(requestBody.categoryId)
      const provider = route.request().headers()['x-provider-id'] ?? 'cloudflare-workers-ai'
      const resultBody = {
        requestId: requestBody.requestId,
        provider,
        cacheHit: false,
        items: generatedWords.map((word, index) => ({
          id: `e2e-imposter-${index + 1}`,
          text: word,
          categoryId,
          kind: 'word',
          locale: 'en',
          hints: wordHints,
        })),
      }
      const progressFrames = [
        { type: 'progress', stage: 'gateway-accepted' },
        { type: 'progress', stage: 'vault-checking', detail: 'Searching the approved category pool.' },
        { type: 'progress', stage: 'vault-miss', detail: 'No approved category batch was found.' },
        { type: 'progress', stage: 'provider-starting', provider, detail: `Generating with ${provider}.` },
        { type: 'progress', stage: 'provider-generated', provider, detail: 'Provider output passed server validation.' },
        { type: 'progress', stage: 'vault-saving', detail: 'Saving the validated batch.' },
        { type: 'progress', stage: 'vault-saved', detail: 'The validated batch was saved to the shared content vault.' },
        { type: 'progress', stage: 'content-ready', provider, detail: 'Validated content is ready.' },
        { type: 'result', status: 200, body: resultBody },
      ]
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson; charset=utf-8',
        body: `${progressFrames.map(frame => JSON.stringify(frame)).join('\n')}\n`,
      })
    })

    await page.context().setOffline(false)
    await page.goto('/')
    await page.getByRole('button', { name: /Imposter/ }).click()

    // Seed packs are loaded lazily. Wait for the built-in category catalogue
    // before querying its contents, then select one category without hardcoding
    // a particular title/description into this gameplay interaction test.
    const categoryChoices = page.locator('.pack-browser .pack-choice')
    await expect(categoryChoices.first()).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => categoryChoices.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(30)
    const categoryCount = await categoryChoices.count()

    const chosenCategory = categoryChoices.first()
    const chosenCategoryButton = chosenCategory.locator('button.pack-select')
    const selectedCategoryName = (await chosenCategory.locator('.pack-main strong').innerText()).replace(/\s+/g, ' ').trim()
    expect(selectedCategoryName).not.toBe('')

    for (let index = 0; index < categoryCount; index += 1) {
      const selectButton = categoryChoices.nth(index).locator('button.pack-select')
      const selected = await selectButton.getAttribute('aria-pressed') === 'true'
      if (index === 0 && !selected) {
        await selectButton.click()
        await expect(selectButton).toHaveAttribute('aria-pressed', 'true')
      } else if (index > 0 && selected) {
        await selectButton.click()
        await expect(selectButton).toHaveAttribute('aria-pressed', 'false')
      }
    }
    await expect(chosenCategoryButton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.pack-browser .panel-heading span')).toHaveText('1 SELECTED')

    const generationRequestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().includes('/v1/content/generate'),
      { timeout: 10_000 },
    )
    // The loading overlay is intentionally unmounted after the game becomes
    // ready. Capture its changing text while it exists so this test verifies
    // the complete startup history without racing that final handoff.
    await page.evaluate(() => {
      const state = window as Window & {
        __kingFunStartupHistory?: string[]
        __kingFunStartupObserver?: MutationObserver
      }
      const history: string[] = []
      const capture = (node: Node) => {
        const element = node instanceof Element ? node : node.parentElement
        if (!element) return
        const overlay = element.matches('.game-loading-layer')
          ? element
          : element.closest('.game-loading-layer') ?? element.querySelector('.game-loading-layer')
        if (!overlay) return
        const snapshot = (overlay as HTMLElement).innerText
        if (history.at(-1) !== snapshot) history.push(snapshot)
      }
      const observer = new MutationObserver(records => {
        for (const record of records) {
          capture(record.target)
          record.addedNodes.forEach(capture)
          record.removedNodes.forEach(capture)
        }
      })
      observer.observe(document.body, { childList: true, characterData: true, subtree: true })
      state.__kingFunStartupHistory = history
      state.__kingFunStartupObserver = observer
    })

    await page.getByRole('button', { name: /^Start game/i }).click()
    const loadingOverlay = page.locator('.game-loading-layer')
    await expect(loadingOverlay).toBeVisible({ timeout: 3_000 })
    const generationRequestObserved = await generationRequestPromise
    expect(generationRequestObserved.url()).toContain('/v1/content/generate')
    const roleCard = page.locator('#imposter-role-reveal')
    await expect(roleCard).toBeVisible({ timeout: 10_000 })
    const startupHistory = await page.evaluate(() => {
      const state = window as Window & {
        __kingFunStartupHistory?: string[]
        __kingFunStartupObserver?: MutationObserver
      }
      state.__kingFunStartupObserver?.disconnect()
      return state.__kingFunStartupHistory?.join('\n') ?? ''
    })
    expect(startupHistory).toContain('No matching content in the vault')
    expect(startupHistory).toMatch(/generated content/i)
    expect(startupHistory).toContain('Validated content saved to vault')
    expect(startupHistory).toMatch(/Content ready from/)
    expect(generationRequest).toMatchObject({
      game: 'imposter',
      itemKind: 'word',
      categoryName: selectedCategoryName,
      count: 1,
    })
    expect(typeof generationRequest?.categoryId).toBe('string')
    expect(String(generationRequest?.categoryId).trim().length).toBeGreaterThan(0)
    expect(typeof generationRequest?.categoryDescription).toBe('string')
    expect(String(generationRequest?.categoryDescription).trim().length).toBeGreaterThan(0)
    const bounds = await roleCard.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
    await page.mouse.down()
    await expect(roleCard).toHaveClass(/is-revealed/, { timeout: 350 })
    await page.mouse.up()
    await expect(roleCard).not.toHaveClass(/is-revealed/)
  })

  test('Truth or Dare challenge wheel renders eight radial sectors after player selection', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Truth or Dare/ }).click()
    await page.getByRole('button', { name: /^Start game/i }).click()
    await expect(page.locator('.game-loading-layer')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('.player-selection-wheel .spin-wheel')).toBeVisible()
    await page.getByRole('button', { name: /spin for a player/i }).click()
    await expect(page.getByRole('button', { name: /spin for truth or dare/i })).toBeVisible({ timeout: 8_000 })
    const challengeWheel = page.locator('.truth-dare-wheel[data-segment-count="8"]')
    await expect(challengeWheel).toBeVisible()
    const labels = challengeWheel.locator('.spin-wheel-label')
    await expect(labels).toHaveCount(8)
    const wheelLabels = await challengeWheel.evaluate(element => {
      const wheel = element.getBoundingClientRect()
      const centerX = wheel.left + wheel.width / 2
      const centerY = wheel.top + wheel.height / 2
      return [...element.querySelectorAll<HTMLElement>('.spin-wheel-label')].map(label => {
        const rect = label.getBoundingClientRect()
        const dx = rect.left + rect.width / 2 - centerX
        const dy = rect.top + rect.height / 2 - centerY
        return {
          angle: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360,
          fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
        }
      })
    })
    expect(wheelLabels.every(label => label.fontSize >= 13)).toBe(true)
    for (let index = 1; index < wheelLabels.length; index += 1) {
      const gap = (wheelLabels[index]!.angle - wheelLabels[index - 1]!.angle + 360) % 360
      expect(Math.abs(gap - 45)).toBeLessThan(2)
    }
  })

  test('custom pack dialog stays centered and inside the mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('button', { name: /Truth or Dare/ }).click()
    await page.getByRole('button', { name: /create (a custom )?pack|create category/i }).click()
    const dialog = page.locator('dialog.custom-pack-editor')
    await expect(dialog).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThan(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
    expect(bounds!.height).toBeLessThanOrEqual(844 * 0.84 + 1)
    await dialog.getByRole('button', { name: 'Close editor' }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('settings provider rows do not cause horizontal overflow at phone and tablet widths', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /king-fun/i })).toBeVisible()
    await page.getByRole('button', { name: /settings/i }).click()
    const providerList = page.getByRole('list', { name: 'AI provider priority' })
    await expect(providerList).toBeVisible()
    await expect(providerList.getByRole('listitem')).toHaveCount(2)
    await expect(providerList.locator('.provider-name').filter({ hasText: 'Google Gemini' })).toBeVisible()
    await expect(providerList.locator('.provider-name').filter({ hasText: 'Groq' })).toBeVisible()
    for (const width of [390, 620, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        providers: [...document.querySelectorAll<HTMLElement>('.kf-provider-row')].map(row => ({
          width: row.clientWidth,
          scrollWidth: row.scrollWidth,
          identityVisible: (() => { const identity = row.querySelector<HTMLElement>('.provider-name'); const rect = identity?.getBoundingClientRect(); return Boolean(identity && rect && rect.width > 0 && rect.height > 0 && getComputedStyle(identity).visibility === 'visible') })(),
        })),
      }))
      expect(metrics.document, `settings overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport)
      expect(metrics.providers.every(row => row.scrollWidth <= row.width), `provider row overflow at ${width}px`).toBe(true)
      expect(metrics.providers.filter(row => row.identityVisible).length).toBeGreaterThanOrEqual(2)
    }
  })

  test('GuessUp keeps team labels and rosters visually separated', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /GuessUp/ }).click()
    await page.getByRole('button', { name: /^Start game/i }).click()
    await expect(page.locator('.game-loading-layer')).toBeVisible({ timeout: 3_000 })
    const teamLine = page.locator('.guess-team-line')
    await expect(teamLine).toBeVisible({ timeout: 8_000 })
    const teams = teamLine.locator(':scope > span')
    await expect(teams).toHaveCount(2)
    await expect(teams.nth(0)).toContainText('TEAM A')
    await expect(teams.nth(1)).toContainText('TEAM B')
  })

  test('header and Settings theme switches stay in sync and persist after reload', async ({ page }) => {
    await page.goto('/')
    const app = page.locator('.app')
    const originalTheme = await app.evaluate(element => element.classList.contains('light') ? 'light' : 'dark')
    const switchedTheme = originalTheme === 'light' ? 'dark' : 'light'
    const headerSwitch = page.getByRole('switch', { name: 'Toggle light/dark appearance' })
    await expect(headerSwitch).toBeVisible()
    await expect(headerSwitch).toHaveAttribute('aria-checked', originalTheme === 'light' ? 'true' : 'false')
    await headerSwitch.click()
    await expect(app).toHaveClass(new RegExp(`\\b${switchedTheme}\\b`))
    await expect(page.locator('html')).toHaveAttribute('data-theme', switchedTheme)
    await expect(page.locator('html')).toHaveCSS('color-scheme', switchedTheme)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', switchedTheme === 'light' ? '#f3f6fa' : '#090d13')

    await page.getByRole('button', { name: /settings/i }).click()
    const settingsSwitch = page.getByRole('switch', { name: 'Light appearance' })
    await expect(settingsSwitch).toBeVisible()
    await expect(settingsSwitch).toHaveAttribute('aria-checked', switchedTheme === 'light' ? 'true' : 'false')
    await settingsSwitch.click()
    await expect(settingsSwitch).toHaveAttribute('aria-checked', originalTheme === 'light' ? 'true' : 'false')
    await expect(app).toHaveClass(new RegExp(`\\b${originalTheme}\\b`))
    await expect(page.locator('html')).toHaveAttribute('data-theme', originalTheme)
    await expect(page.locator('html')).toHaveCSS('color-scheme', originalTheme)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', originalTheme === 'light' ? '#f3f6fa' : '#090d13')

    await page.waitForFunction(async expectedTheme => await new Promise<boolean>(resolve => {
      const open = indexedDB.open('king-fun-local', 2)
      open.onerror = () => resolve(false)
      open.onsuccess = () => {
        const database = open.result
        const request = database.transaction('appState', 'readonly').objectStore('appState').get('current')
        request.onsuccess = () => { resolve(request.result?.value?.theme === expectedTheme); database.close() }
        request.onerror = () => { resolve(false); database.close() }
      }
    }), originalTheme)
    await page.reload()
    await expect(app).toHaveClass(new RegExp(`\\b${originalTheme}\\b`))
    await expect(page.locator('html')).toHaveAttribute('data-theme', originalTheme)
    await expect(page.locator('html')).toHaveCSS('color-scheme', originalTheme)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', originalTheme === 'light' ? '#f3f6fa' : '#090d13')
  })

  test('ambient 3D scene responds to pointer input and can be paused accessibly', async ({ page }) => {
    await page.goto('/')
    const scene = page.locator('[data-ambient-scene]')
    await expect(scene).toBeVisible()
    await expect(scene).toHaveAttribute('data-paused', 'false')
    const pauseButton = page.getByRole('button', { name: 'Pause ambient graphics' })
    await expect(pauseButton).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(540, 260)
    await expect.poll(() => scene.getAttribute('data-interaction-count')).not.toBe('0')
    await page.mouse.click(540, 260)
    await pauseButton.click()
    await expect(scene).toHaveAttribute('data-paused', 'true')
    const playButton = page.getByRole('button', { name: 'Play ambient graphics' })
    await expect(playButton).toHaveAttribute('aria-pressed', 'false')
    await playButton.click()
    await expect(scene).toHaveAttribute('data-paused', 'false')
  })

  test('system reduced-motion preference pauses ambient animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('[data-ambient-scene]')).toHaveAttribute('data-paused', 'true')
    await expect(page.getByRole('button', { name: /ambient graphics disabled by motion preference/i })).toBeDisabled()
  })

  test('saved in-app reduced-motion preference pauses ambient animation', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /settings/i }).click()
    await page.getByLabel(/motion|reduce motion/i).selectOption('reduce')
    await expect(page.locator('[data-ambient-scene]')).toHaveAttribute('data-paused', 'true')
    await expect(page.getByRole('button', { name: /ambient graphics disabled by motion preference/i })).toBeDisabled()
  })

  test('game mode choices expose their selected state to assistive technology', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Truth or Dare/ }).click()
    const wheelMode = page.getByRole('button', { name: /Spin the wheel/ })
    const orderedMode = page.getByRole('button', { name: /One at a time/ })
    await expect(wheelMode).toHaveAttribute('aria-pressed', 'true')
    await orderedMode.click()
    await expect(orderedMode).toHaveAttribute('aria-pressed', 'true')
    await expect(wheelMode).toHaveAttribute('aria-pressed', 'false')
  })

  test('provider order can be changed with explicit keyboard-accessible controls', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /settings/i }).click()
    await expect(page.getByRole('heading', { name: /AI-assisted content|AI content/i })).toBeVisible()
    const providerList = page.getByRole('list', { name: 'AI provider priority' })
    await expect(providerList).toBeVisible()
    const firstProvider = providerList.getByRole('listitem').first()
    await expect(firstProvider).toBeVisible()
    await expect(firstProvider.locator('.provider-identity strong')).toHaveText('Google Gemini')
    await expect(firstProvider.locator('.provider-identity strong')).toBeVisible()
    await expect(firstProvider.getByRole('switch')).toHaveAccessibleName(/Google Gemini (ON|OFF)/)
    await firstProvider.getByRole('button', { name: 'Move Google Gemini down' }).click()
    await expect(providerList.getByRole('listitem').first().getByText('Groq', { exact: true })).toBeVisible()
    await expect(providerList.getByRole('listitem').first().getByText('01')).toBeVisible()
  })

  test('command palette opens from the keyboard and exposes searchable actions', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /king-fun/i })).toBeVisible()
    const appRoot = page.locator('.app')
    await appRoot.focus()
    await expect(appRoot).toBeFocused()
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Quick actions' })
    await expect(dialog).toBeVisible()
    const search = page.getByPlaceholder('Jump to a game or screen…')
    await expect(search).toBeFocused()
    await search.fill('History')
    await expect(dialog.getByText('Game history')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('main screens have no serious or critical automated accessibility violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /king-fun/i })).toBeVisible()
    await expect(page.locator('.hero-primary-action')).toBeEnabled()
    const homeScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(seriousOrCritical(homeScan.violations)).toEqual([])

    await page.getByRole('button', { name: /settings/i }).click()
    await expect(page.getByRole('list', { name: 'AI provider priority' })).toBeVisible()
    const settingsScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(seriousOrCritical(settingsScan.violations)).toEqual([])

    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: /Imposter/ }).click()
    await expect(page.getByRole('heading', { name: /set up imposter/i })).toBeVisible({ timeout: 10_000 })
    const setupScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(seriousOrCritical(setupScan.violations)).toEqual([])
  })
})
