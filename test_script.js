const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

        console.log("Navigating to http://localhost:5173/auth ...");
        await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });
        
        console.log("Waiting for auth page to settle...");
        await page.waitForTimeout(2000);
        
        // Let's try to click the Admin Demo button.
        console.log("Looking for Admin Demo button...");
        const buttons = await page.$$('button');
        let clicked = false;
        for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && text.includes('Admin Demo')) {
                console.log("Clicking Admin Demo...");
                await button.click();
                clicked = true;
                break;
            }
        }
        
        if (clicked) {
            console.log("Waiting for navigation to dashboard...");
            await page.waitForTimeout(3000);
            const content = await page.content();
            if (content.includes("Fleet Health")) {
                console.log("SUCCESS: Dashboard rendered correctly.");
            } else {
                console.log("WARNING: Dashboard text not found.");
            }
        }
        
        await browser.close();
    } catch (err) {
        console.error("SCRIPT ERROR:", err);
        process.exit(1);
    }
})();
