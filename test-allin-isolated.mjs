import { chromium } from 'playwright';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTwoPlayerAllin() {
  console.log('=== 两人 all-in 浏览器隔离测试 ===\n');

  const browser1 = await chromium.launch({ headless: true });
  const browser2 = await chromium.launch({ headless: true });

  const context1 = await browser1.newContext();
  const context2 = await browser2.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  let roomId = null;

  try {
    // Alice 创建房间
    console.log('1. Alice 创建房间...');
    await page1.goto('http://localhost:5173');
    await page1.waitForLoadState('networkidle');
    await page1.fill('input[placeholder="输入你的昵称"]', 'Alice');
    await page1.click('button:has-text("创建房间")');
    await page1.waitForTimeout(500);
    await page1.click('button:has-text("确认创建")');
    await page1.waitForTimeout(1000);
    roomId = await page1.textContent('.room-info strong');
    console.log(`   房间号: ${roomId}`);

    // Bob 加入房间
    console.log('2. Bob 加入房间...');
    await page2.goto('http://localhost:5173');
    await page2.waitForLoadState('networkidle');
    await page2.fill('input[placeholder="输入你的昵称"]', 'Bob');
    await page2.click('button:has-text("加入房间")');
    await page2.waitForTimeout(500);
    await page2.fill('input[placeholder*="房间号"]', roomId);
    await page2.click('button:has-text("加入")');
    await page2.waitForTimeout(1000);
    console.log('   Bob 已加入');

    // 双方准备
    console.log('3. 双方准备...');
    await page2.click('button:has-text("准备")');
    await page2.waitForTimeout(500);
    await page1.waitForTimeout(500);
    const startBtn = page1.locator('button:has-text("开始游戏")');
    if (await startBtn.isEnabled()) {
      await startBtn.click();
    }
    await page1.waitForTimeout(2000);

    console.log('4. 游戏已开始');

    const getChips = async (page, name) => {
      const seat = page.locator('.seat').filter({ hasText: name });
      return seat.locator('.player-chips').textContent().then(t => parseInt(t.replace(/[^0-9]/g, '')));
    };

    const aliceChipsStart = await getChips(page1, 'Alice');
    const bobChipsStart = await getChips(page1, 'Bob');
    console.log(`   Alice 筹码: ${aliceChipsStart}, Bob 筹码: ${bobChipsStart}`);

    // 等待回合
    await sleep(1000);

    // 检查当前玩家
    const getCurrentPlayerName = async (page) => {
      const el = page.locator('.seat.current-turn .player-name');
      const text = await el.textContent().catch(() => null);
      if (!text) return null;
      return text.replace(' (我)', '').trim();
    };

    const currentBefore = await getCurrentPlayerName(page1);
    console.log(`   当前行动: ${currentBefore}`);

    // 场景：Bob 是小盲，先行动。让 Bob call，然后 Alice raise/all-in
    // 实际上 preflop 顺序是：SB (Bob) -> BB (Alice)
    if (currentBefore === 'Bob') {
      console.log('5. Bob 跟注 (大盲)...');
      const callBtn = page2.locator('.btn-call');
      if (await callBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await callBtn.click();
        console.log('   Bob 跟注');
      } else {
        console.log('   未找到 call 按钮');
      }
      await sleep(1500);
    }

    const currentAfter = await getCurrentPlayerName(page1);
    console.log(`   现在轮到: ${currentAfter}`);

    if (currentAfter === 'Alice') {
      console.log('6. Alice all-in...');
      const allinBtn = page1.locator('.btn-allin');
      if (await allinBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await allinBtn.click();
        console.log('   Alice all-in');
      } else {
        console.log('   未找到 all-in 按钮');
      }
      await sleep(1500);
    }

    // 现在轮到 Bob
    const currentBob = await getCurrentPlayerName(page2);
    console.log(`   Bob 回合: ${currentBob}`);

    if (currentBob === 'Bob') {
      console.log('7. Bob 决策...');
      const callBtn = page2.locator('.btn-call');
      const allinBtn = page2.locator('.btn-allin');

      if (await callBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await callBtn.click();
        console.log('   Bob 跟注');
      } else if (await allinBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await allinBtn.click();
        console.log('   Bob all-in');
      }
      await sleep(2000);
    }

    // 等待结算
    await sleep(2000);

    const finalPhase = await page1.textContent('.phase');
    console.log(`\n8. 最终阶段: ${finalPhase}`);

    const aliceChipsEnd = await getChips(page1, 'Alice');
    const bobChipsEnd = await getChips(page1, 'Bob');
    console.log(`   Alice 最终筹码: ${aliceChipsEnd}`);
    console.log(`   Bob 最终筹码: ${bobChipsEnd}`);
    console.log(`   总筹码: ${aliceChipsEnd + bobChipsEnd} (应该是 ${aliceChipsStart + bobChipsStart})`);

    const settlementVisible = await page1.locator('.settlement-panel').isVisible();
    console.log(`   结算面板: ${settlementVisible ? '显示' : '未显示'}`);

    const totalConserved = (aliceChipsEnd + bobChipsEnd) === (aliceChipsStart + bobChipsStart);
    const enteredShowdown = finalPhase === 'SHOWDOWN';

    console.log('\n=== 测试结果 ===');
    console.log(`筹码守恒: ${totalConserved ? '✅' : '❌'}`);
    console.log(`进入 SHOWDOWN: ${enteredShowdown ? '✅' : '❌'}`);

    if (totalConserved && enteredShowdown) {
      console.log('\n✅ 两人 all-in 测试通过！');
    } else {
      console.log('\n❌ 测试失败');
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

testTwoPlayerAllin();
