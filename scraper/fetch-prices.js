const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const WEBSITE_URL =
    'https://www.lalithaajewellery.com/gold?wearing_type=women%2Cunisex&include_null_gender=true&is_customizable=false&sortBy=visit_count&sortOrder=desc';

// Save prices.json in the project root.
const OUTPUT_FILE = path.join(__dirname, '..', 'prices.json');

async function getMetalPrice(page, label) {

    console.log(`Extracting ${label}...`);

    // Find the label inside the price popup.
    const labelElement = page.getByText(label, {
        exact: true
    });

    await labelElement.waitFor({
        state: 'visible',
        timeout: 15000
    });

    // The price row is the label's parent element.
    const row = labelElement.locator('xpath=..');

    // The second span contains the price.
    const priceElement = row.locator(':scope > span').nth(1);

    const priceText = await priceElement.innerText();

    // Remove currency symbol and commas.
    const price = Number(
        priceText.replace(/[^\d.]/g, '')
    );

    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(
            `Invalid price for ${label}: ${priceText}`
        );
    }

    console.log(`${label}: ₹${price}`);

    return price;
}

async function fetchPrices() {

    let browser;

    try {

        console.log('Starting Lalithaa price scraper...');

        browser = await chromium.launch({
            headless: true
        });

        const page = await browser.newPage({
    viewport: {
        width: 1440,
        height: 1000
    }
});

        console.log('Opening Lalithaa Jewellery website...');

        await page.goto(WEBSITE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Allow the page to finish rendering.
        await page.waitForTimeout(3000);

        console.log("Opening Today's Gold Rate popup...");

        const rateButton = page.getByRole('button', {
    name: "Today's Gold Rate"
});

await rateButton.waitFor({
    state: 'attached',
    timeout: 20000
});

// Trigger the button's click event directly.
await rateButton.evaluate(button => button.click());

console.log("Today's Gold Rate button clicked.");

        // Wait until the rate popup appears.
        await page.getByText('Gold (22KT / 1g)', {
            exact: true
        }).waitFor({
            state: 'visible',
            timeout: 20000
        });

        console.log('Rate popup opened successfully.');

        // Extract metal prices.
        const gold22K = await getMetalPrice(
            page,
            'Gold (22KT / 1g)'
        );

        const gold24K = await getMetalPrice(
            page,
            'Gold (24KT / 1g)'
        );

        const silver = await getMetalPrice(
            page,
            'Silver (1g)'
        );

        // Basic validation.
        if (gold22K >= gold24K) {
            throw new Error(
                '22K gold price must be lower than 24K gold price.'
            );
        }

        if (silver >= gold22K) {
            throw new Error(
                'Silver price appears invalid.'
            );
        }

        // Extract the displayed last-updated text.
        const updatedText = await page.getByText(
            /^Last updated:/,
            { exact: false }
        ).innerText();

        console.log('Website update information:', updatedText);

        // Build JSON.
        const prices = {
            goldPrice: gold24K,
            gold22KPrice: gold22K,
            gold24KPrice: gold24K,
            silverPrice: silver,
            state: 'Tamil Nadu',
            siteLastUpdated: updatedText,
            fetchedAt: new Date().toISOString()
        };

        // Save only after all validations succeed.
        fs.writeFileSync(
            OUTPUT_FILE,
            JSON.stringify(prices, null, 2),
            'utf8'
        );

        console.log('\nPrices saved successfully!');
        console.log(prices);

    } catch (error) {

        console.error('\nPrice scraping failed!');
        console.error(error);

        process.exitCode = 1;

    } finally {

        if (browser) {
            await browser.close();
        }

    }
}

fetchPrices();