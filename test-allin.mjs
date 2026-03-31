import { chromium } from 'playwright';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTwoPlayerAllin() {
  console.log('=== 开始两人 all-in 浏览器测试 ===\n');

  // 创建两个独立的浏览器上下文（避免缓存共享）
  const browser1 = await chromium.launch({ headless: true });
  const browser2 = await chromium.launch({ headless: true });

  const context1 = await browser1.newContext();
  const context2 = await browser2.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  let roomId = null;

  try {
    // 页面1 - 创建房间
    console.log('1. Player1 创建房间...');
    await page1.goto('http://localhost:5179');
    await page1.waitForLoadState('networkidle');

    // 输入名字并创建房间
    const nameInput1 = page1.locator('input[type="text"]').first();
    await nameInput1.fill('Alice');
    await page1.locator('button:has-text("创建房间")').click();
    await page1.waitForTimeout(1000);

    // 获取房间号
    const roomInfo1 = await page1.locator('.room-info strong').textContent();
    roomId = roomInfo1;
    console.log(`   房间号: ${roomId}`);

    // 页面2 - 加入房间
    console.log('2. Player2 加入房间...');
    await page2.goto('http://localhost:5179');
    await page2.waitForLoadState('networkidle');

    const nameInput2 = page2.locator('input[type="text"]').first();
    await nameInput2.fill('Bob');
    await page2.locator('button:has-text("加入房间")').click();
    await page2.waitForTimeout(500);

    const roomInput2 = page2.locator('input[placeholder*="房间号"]');
    await roomInput2.fill(roomId);
    await page2.locator('button:has-text("加入房间")').click();
    await page2.waitForTimeout(1000);

    console.log('   Player2 已加入房间');

    // 页面1 - 准备
    console.log('3. Player1 点击准备...');
    await page1.locator('button:has-text("准备")').click();
    await page1.waitForTimeout(500);

    // 页面2 - 准备
    console.log('4. Player2 点击准备...');
    await page2.locator('button:has-text("准备")').click();
    await page2.waitForTimeout(500);

    // 等待房主开始游戏
    console.log('5. 等待房主开始游戏...');
    await page1.waitForTimeout(1000);

    // 如果 Player1 显示"开始游戏"按钮，点击它
    const startBtn = page1.locator('button:has-text("开始游戏")');
    if (await startBtn.isVisible() && await startBtn.isEnabled()) {
      console.log('   Player1 点击开始游戏');
      await startBtn.click();
    }

    // 等待游戏开始
    await page1.waitForTimeout(2000);

    console.log('6. 游戏已开始，检查状态...');

    // 检查当前玩家
    const phase1 = await page1.locator('.phase').textContent();
    console.log(`   当前阶段: ${phase1}`);

    // 获取玩家筹码
    const getPlayerChips = async (page, name) => {
      const seat = page.locator('.player-seat').filter({ hasText: name });
      const chips = await seat.locator('.player-chips').textContent();
      return parseInt(chips.replace(/[^0-9]/g, ''));
    };

    const aliceChips1 = await getPlayerChips(page1, 'Alice');
    const bobChips1 = await getPlayerChips(page1, 'Bob');
    console.log(`   Alice 筹码: ${aliceChips1}, Bob 筹码: ${bobChips1}`);

    // 等待 Alice 的回合（当前应该是 Bob 先行动，因为 Bob 是小盲）
    await page1.waitForTimeout(1000);

    // 检查是谁的回合
    const currentPlayer = await page1.evaluate(() => {
      const activeSeat = document.querySelector('.player-seat.current-turn');
      return activeSeat ? activeSeat.querySelector('.player-name')?.textContent : 'unknown';
    });
    console.log(`   当前行动玩家: ${currentPlayer}`);

    // 如果是 Bob 的回合，让他 fold（跳过）
    if (currentPlayer === 'Bob') {
      console.log('7. Bob 的回合 - 让 Bob fold...');

      // 检查是否有弃牌按钮
      const foldBtn = page2.locator('.btn-fold');
      if (await foldBtn.isVisible()) {
        await foldBtn.click();
        console.log('   Bob 弃牌');
      } else {
        // 尝试 call 或其他按钮
        const callBtn = page2.locator('.btn-call');
        if (await callBtn.isVisible()) {
          await callBtn.click();
          console.log('   Bob 跟注/过牌');
        }
      }
      await page1.waitForTimeout(1000);
    }

    // 现在应该是 Alice 的回合
    const currentPlayer2 = await page1.evaluate(() => {
      const activeSeat = document.querySelector('.player-seat.current-turn');
      return activeSeat ? activeSeat.querySelector('.player-name')?.textContent : 'unknown';
    });
    console.log(`   当前行动玩家: ${currentPlayer2}`);

    // 检查 Alice 的操作面板
    const actionPanel = await page1.locator('.action-panel').isVisible();
    console.log(`   Alice 操作面板可见: ${actionPanel}`);

    // 查找 all-in 按钮
    const allinBtn = page1.locator('.btn-allin');
    const isAllinVisible = await allinBtn.isVisible();
    console.log(`   All-in 按钮可见: ${isAllinVisible}`);

    if (isAllinVisible) {
      const allinText = await allinBtn.textContent();
      console.log(`   All-in 按钮文字: ${allinText}`);
    }

    // 如果有 raise 按钮也检查一下
    const raiseBtn = page1.locator('.btn-raise');
    const isRaiseVisible = await raiseBtn.isVisible();
    if (isRaiseVisible) {
      const raiseText = await raiseBtn.textContent();
      console.log(`   Raise 按钮文字: ${raiseText}`);
    }

    // 等待结算
    await page1.waitForTimeout(2000);

    // 检查是否进入 showdown
    const phase2 = await page1.locator('.phase').textContent();
    console.log(`\n   最终阶段: ${phase2}`);

    // 检查筹码
    const aliceChips2 = await getPlayerChips(page1, 'Alice');
    const bobChips2 = await getPlayerChips(page1, 'Bob');
    console.log(`   Alice 最终筹码: ${aliceChips2}, Bob 最终筹码: ${bobChips2}`);
    console.log(`   总筹码: ${aliceChips2 + bobChips2} (应该是 ${aliceChips1 + bobChips1})`);

    // 检查是否有结算弹窗
    const settlement = await page1.locator('.settlement-panel').isVisible();
    console.log(`   结算面板可见: ${settlement}`);

    if (settlement) {
      const winner = await page1.locator('.settlement-winner').textContent();
      console.log(`   获胜者: ${winner}`);
    }

    // 测试结果
    const totalChips = aliceChips2 + bobChips2;
    if (totalChips === aliceChips1 + bobChips1) {
      console.log('\n✅ 测试通过：筹码守恒');
    } else {
      console.log(`\n❌ 测试失败：筹码不守恒 (开始: ${aliceChips1 + bobChips1}, 结束: ${totalChips})`);
    }

    if (phase2 === 'SHOWDOWN') {
      console.log('✅ 测试通过：进入 SHOWDOWN');
    } else {
      console.log(`❌ 测试失败：未进入 SHOWDOWN (phase=${phase2})`);
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

testTwoPlayerAllin();
