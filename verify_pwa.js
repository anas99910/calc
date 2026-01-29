const fs = require('fs');
const puppeteer = require('puppeteer-core');

(async () => {
    console.log("🚀 Starting PWA Verification Test...");

    // 1. Detect Local Chrome Path (Windows)
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    let executablePath = possiblePaths.find(path => fs.existsSync(path));

    if (executablePath) {
        console.log(`💻 Found local Chrome at: ${executablePath}`);
    } else {
        console.log("⚠️ Could not find local Chrome, will try default bundled Chromium...");
        executablePath = undefined; // Let Puppeteer use its default if available
    }

    try {
        // Launch browser (visible)
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: executablePath,
            args: ['--window-size=1280,800']
        });

        const page = await browser.newPage();

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('PWA')) {
                console.log('🌟 PAGE PWA LOG:', text);
            } else {
                console.log('PAGE LOG:', text);
            }
        });

        console.log("🌐 Navigating to http://localhost:8080...");
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });

        // Wait for SW and events
        await new Promise(r => setTimeout(r, 3000));

        // Start Verification
        console.log("\n--- VERIFICATION RESULTS ---");

        // Check 1: deferredPrompt
        const isInstallable = await page.evaluate(() => {
            return !!window.deferredPrompt;
        });

        if (isInstallable) {
            console.log("✅ CHECK 1 PASSED: 'beforeinstallprompt' was captured globally.");
        } else {
            console.error("❌ CHECK 1 FAILED: 'window.deferredPrompt' is null.");
            console.log("   (Browser did not consider the app installable or event fired too early/late)");
        }

        // Check 2: Settings Button
        console.log("🖱️ Opening Settings...");
        await page.click('#btn-settings');
        await new Promise(r => setTimeout(r, 1000));

        const btnStatus = await page.evaluate(() => {
            const btn = document.getElementById('btn-install-app');
            if (!btn) return 'MISSING';
            if (btn.offsetParent === null) return 'HIDDEN';
            return 'VISIBLE';
        });

        if (btnStatus === 'VISIBLE') {
            console.log("✅ CHECK 2 PASSED: Install button is visible.");
        } else {
            console.error(`❌ CHECK 2 FAILED: Install button is ${btnStatus}.`);
        }

        console.log("\n⏳ Keeping browser open for 10 seconds for manual observation...");
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();

    } catch (err) {
        console.error("⚠️ TEST SCRIPT ERROR:", err);
    }
})();
