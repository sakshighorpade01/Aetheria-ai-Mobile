// browser-handler.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const net = require('net');
const axios = require('axios');
const config = require('./config');

class BrowserHandler {
    constructor(eventEmitter, appDataPath, getAuthTokenFunc) {
        this.eventEmitter = eventEmitter;
        this.appDataPath = appDataPath;
        this.getAuthToken = getAuthTokenFunc;
        
        this.managedBrowserProcess = null;
        this.browser = null;
        this.page = null;
        this.isConnected = false;
    }

    async _uploadScreenshot(screenshotBase64) {
        try {
            const token = await this.getAuthToken();
            if (!token) {
                throw new Error("Authentication token not available for screenshot upload.");
            }

            const imageBuffer = Buffer.from(screenshotBase64, 'base64');
            const fileName = `screenshot-${Date.now()}.png`;

            const urlResponse = await axios.post(
                `${config.backend.url}/api/generate-upload-url`,
                { fileName },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const { signedURL, path } = urlResponse.data;
            if (!signedURL || !path) {
                throw new Error("Backend did not return a valid signed URL or path.");
            }

            await axios.put(signedURL, imageBuffer, {
                headers: { 'Content-Type': 'image/png' }
            });

            console.log(`Screenshot successfully uploaded to Supabase path: ${path}`);
            return path;

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error("Screenshot upload failed:", errorMessage);
            return null;
        }
    }

    _getBrowserPaths() {
        let executablePath;
        try {
            if (process.platform === 'win32') {
                const programFiles = process.env.ProgramW6432;
                const chromePath = path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe');
                const edgePath = path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
                if (fs.existsSync(chromePath)) executablePath = chromePath;
                else if (fs.existsSync(edgePath)) executablePath = edgePath;
            } else if (process.platform === 'darwin') {
                const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
                if (fs.existsSync(chromePath)) executablePath = chromePath;
                else if (fs.existsSync(edgePath)) executablePath = edgePath;
            } else {
                executablePath = '/usr/bin/google-chrome';
            }
            if (!executablePath || !fs.existsSync(executablePath)) return null;
        } catch (error) {
            console.error('Error getting browser executable path:', error);
            return null;
        }
        const userDataDir = path.join(this.appDataPath, 'aios-browser-profile');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        return { executablePath, userDataDir };
    }

    async _isPortInUse(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
            server.once('listening', () => {
                server.close();
                resolve(false);
            });
            server.listen(port, '127.0.0.1');
        });
    }

    initialize() {
        this.eventEmitter.on('execute-browser-command', (commandPayload) => {
            this.handleCommand(commandPayload);
        });
        console.log('BrowserHandler initialized and listening for commands.');
        const paths = this._getBrowserPaths();
        if (paths) {
            console.log('BrowserHandler: Found browser at:', paths.executablePath);
            console.log('BrowserHandler: Using data directory:', paths.userDataDir);
        } else {
            console.error('BrowserHandler: Could not find browser executable');
        }
    }

    async _launchManagedBrowser() {
        if (this.managedBrowserProcess) return;
        const paths = this._getBrowserPaths();
        if (!paths) return;
        const args = [
            `--remote-debugging-port=9222`, `--user-data-dir=${paths.userDataDir}`,
            `--no-first-run`, `--no-default-browser-check`, `--disable-background-timer-throttling`,
            `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`
        ];
        console.log(`Launching browser with command: ${paths.executablePath} ${args.join(' ')}`);
        try {
            this.managedBrowserProcess = spawn(paths.executablePath, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
            this.managedBrowserProcess.stdout.on('data', (data) => console.log(`BrowserHandler (stdout): ${data}`));
            this.managedBrowserProcess.stderr.on('data', (data) => console.error(`BrowserHandler (stderr): ${data}`));
            this.managedBrowserProcess.on('error', (err) => console.error('Failed to start browser process:', err));
            this.managedBrowserProcess.on('close', (code) => {
                console.log(`Browser process exited with code ${code}`);
                this.managedBrowserProcess = null;
                this.isConnected = false;
            });
            console.log('Browser process launched successfully');
        } catch (error) {
            console.error('Error launching browser:', error);
        }
    }

    async _connect() {
        if (this.isConnected) return true;
        try {
            console.log('Attempting to connect to browser at http://localhost:9222...');
            this.browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
            this.isConnected = true;
            console.log('Successfully connected to browser via CDP.');
            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();
            console.log(`Connected to page: ${this.page.url()}`);
            this.browser.on('disconnected', () => {
                console.log('Browser disconnected.');
                this.isConnected = false;
                this.browser = null;
                this.page = null;
            });
            return true;
        } catch (error) {
            console.log('Failed to connect to browser:', error.message);
            return false;
        }
    }

    async handleCommand(commandPayload) {
        const { action, request_id } = commandPayload;
        console.log(`BrowserHandler: Processing command '${action}' with request_id: ${request_id}`);
        if (!this.isConnected && !['status', 'list_tabs'].includes(action)) {
            this._emitResult(request_id, { status: 'error', error: 'Browser is not connected. Use the "get_status" tool first.' });
            return;
        }
        try {
            let result;
            switch (action) {
                case 'status':
                    const isConnected = await this._connect();
                    if (isConnected) {
                        result = { status: 'connected', url: await this.page.url() };
                    } else {
                        await this._launchManagedBrowser();
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        const isNowConnected = await this._connect();
                        result = isNowConnected ? { status: 'connected', url: await this.page.url() } : { status: 'disconnected', error: 'Connection failed after launch.' };
                    }
                    break;
                case 'navigate':
                    await this.page.goto(commandPayload.url, { waitUntil: 'networkidle2' });
                    result = await this.getView();
                    break;
                case 'get_view':
                    result = await this.getView();
                    break;
                case 'click':
                    await this.page.click(`[data-aios-id="${commandPayload.element_id}"]`);
                    await this.page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
                    result = await this.getView();
                    break;
                case 'type':
                    await this.page.type(`[data-aios-id="${commandPayload.element_id}"]`, commandPayload.text);
                    result = await this.getView();
                    break;
                case 'scroll':
                    await this.page.evaluate(direction => window.scrollBy(0, direction === 'down' ? window.innerHeight * 0.8 : -window.innerHeight * 0.8), commandPayload.direction);
                    result = await this.getView();
                    break;
                case 'go_back':
                    await this.page.goBack({ waitUntil: 'networkidle2' });
                    result = await this.getView();
                    break;
                case 'go_forward':
                    await this.page.goForward({ waitUntil: 'networkidle2' });
                    result = await this.getView();
                    break;
                case 'list_tabs':
                    if (!this.isConnected) {
                        result = { status: 'success', tabs: [] };
                        break;
                    }
                    const pages = await this.browser.pages();
                    result = {
                        status: 'success',
                        tabs: await Promise.all(pages.map(async (p, i) => ({
                            index: i,
                            title: await p.title(),
                            url: p.url()
                        })))
                    };
                    break;
                case 'open_new_tab':
                    this.page = await this.browser.newPage();
                    await this.page.goto(commandPayload.url, { waitUntil: 'networkidle2' });
                    await this.page.bringToFront();
                    result = await this.getView();
                    break;
                case 'switch_to_tab':
                    const allPages = await this.browser.pages();
                    if (commandPayload.tab_index < allPages.length) {
                        this.page = allPages[commandPayload.tab_index];
                        await this.page.bringToFront();
                        result = await this.getView();
                    } else {
                        result = { status: 'error', error: 'Invalid tab index.' };
                    }
                    break;
                case 'close_tab':
                    const pagesToClose = await this.browser.pages();
                    if (commandPayload.tab_index < pagesToClose.length) {
                        if (pagesToClose.length === 1) {
                            result = { status: 'error', error: 'Cannot close the last tab.' };
                            break;
                        }
                        await pagesToClose[commandPayload.tab_index].close();
                        const remainingPages = await this.browser.pages();
                        this.page = remainingPages[0];
                        await this.page.bringToFront();
                        result = { status: 'success', message: `Tab ${commandPayload.tab_index} closed.` };
                    } else {
                        result = { status: 'error', error: 'Invalid tab index.' };
                    }
                    break;
                case 'hover':
                    await this.page.hover(`[data-aios-id="${commandPayload.element_id}"]`);
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                    result = await this.getView();
                    break;
                case 'select_option':
                    await this.page.select(`[data-aios-id="${commandPayload.element_id}"]`, commandPayload.value);
                    result = await this.getView();
                    break;
                case 'handle_alert':
                    this.page.once('dialog', async dialog => {
                        await dialog[commandPayload.alert_action]();
                    });
                    result = { status: 'success', message: `Alert handler for '${commandPayload.alert_action}' is ready.` };
                    break;
                case 'press_key':
                    await this.page.keyboard.press(commandPayload.key);
                    await this.page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
                    result = await this.getView();
                    break;
                case 'extract_text':
                    const text = await this.page.$eval(`[data-aios-id="${commandPayload.element_id}"]`, el => el.innerText);
                    result = { status: 'success', text: text };
                    break;
                case 'get_attributes':
                    const attrs = await this.page.$eval(`[data-aios-id="${commandPayload.element_id}"]`, el => {
                        const attributes = {};
                        for (const attr of el.attributes) {
                            attributes[attr.name] = attr.value;
                        }
                        return attributes;
                    });
                    result = { status: 'success', attributes: attrs };
                    break;
                case 'extract_table':
                    const markdownTable = await this.page.$eval(`[data-aios-id="${commandPayload.element_id}"]`, table => {
                        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim().replace(/\|/g, ''));
                        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                            Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\|/g, ''))
                        );
                        let markdown = `| ${headers.join(' | ')} |\n`;
                        markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
                        rows.forEach(row => {
                            markdown += `| ${row.join(' | ')} |\n`;
                        });
                        return markdown;
                    });
                    result = { status: 'success', table_markdown: markdownTable };
                    break;
                case 'refresh':
                    await this.page.reload({ waitUntil: 'networkidle2' });
                    result = await this.getView();
                    break;
                case 'wait_for_element':
                    try {
                        await this.page.waitForSelector(commandPayload.selector, { timeout: commandPayload.timeout * 1000 });
                        result = { status: 'success', message: `Element '${commandPayload.selector}' appeared.` };
                    } catch (error) {
                        result = { status: 'error', error: `Element '${commandPayload.selector}' did not appear within ${commandPayload.timeout} seconds.` };
                    }
                    break;
                case 'manage_cookies':
                    if (commandPayload.cookie_action === 'clear_all') {
                        const client = await this.page.target().createCDPSession();
                        await client.send('Network.clearBrowserCookies');
                        result = { status: 'success', message: 'All cookies cleared.' };
                    } else if (commandPayload.cookie_action === 'accept_all') {
                        const selectors = ['[id*="consent"]', '[class*="consent"]', '[id*="cookie"]', '[class*="cookie"]', 'button', 'a'];
                        const texts = /Accept|Allow|Agree|OK|Got it|I understand|I agree/i;
                        const clicked = await this.page.evaluate((selectors, textsSource) => {
                            const buttons = Array.from(document.querySelectorAll(selectors.join(',')));
                            const textsRegex = new RegExp(textsSource, 'i');
                            const target = buttons.find(el => textsRegex.test(el.innerText));
                            if (target) {
                                target.click();
                                return true;
                            }
                            return false;
                        }, selectors, texts.source);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        result = await this.getView();
                        result.message = clicked ? 'Attempted to accept cookies.' : 'No common cookie button found.';
                    }
                    break;
                default:
                    result = { status: 'error', error: `Unknown browser command: ${action}` };
            }
            this._emitResult(request_id, result);
        } catch (error) {
            console.error(`BrowserHandler: Error executing browser command '${action}':`, error.message);
            this._emitResult(request_id, { status: 'error', error: error.message });
        }
    }

    async getView() {
        if (!this.isConnected) return { status: 'error', error: 'Browser not connected.' };
        try {
            const interactive_elements = await this.page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('a, button, input, textarea, select, [role="button"]'));
                const visibleElements = [];
                elements.forEach((el, index) => {
                    const rect = el.getBoundingClientRect();
                    const isVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth && rect.width > 0 && rect.height > 0;
                    if (isVisible) {
                        el.setAttribute('data-aios-id', index);
                        visibleElements.push({
                            id: index, tag: el.tagName.toLowerCase(),
                            text: el.innerText || el.value || el.getAttribute('aria-label') || '',
                            ariaLabel: el.getAttribute('aria-label') || '',
                        });
                    }
                });
                return visibleElements;
            });
            const screenshot_base64 = await this.page.screenshot({ encoding: 'base64' });
            const screenshot_path = await this._uploadScreenshot(screenshot_base64);
            const viewData = {
                status: 'success', title: await this.page.title(),
                url: this.page.url(), interactive_elements: interactive_elements,
            };
            if (screenshot_path) {
                viewData.screenshot_path = screenshot_path;
            } else {
                console.warn("getView: Screenshot upload failed, path not included in result.");
            }
            return viewData;
        } catch (error) {
            console.error("Error in getView:", error.message);
            return { status: 'error', error: `Failed to get page view: ${error.message}` };
        }
    }

    _emitResult(request_id, result) {
        this.eventEmitter.emit('browser-command-result', { request_id, result });
    }

    async cleanup() {
        console.log('Cleaning up BrowserHandler...');
        
        // --- MODIFICATION START ---
        // The block that deletes the browser profile is now commented out to enable persistence.
        /*
        try {
            const profilePath = path.join(this.appDataPath, 'aios-browser-profile');
            if (fs.existsSync(profilePath)) {
                console.log(`Removing browser profile at: ${profilePath}`);
                fs.rmSync(profilePath, { recursive: true, force: true });
            }
        } catch (error) {
            console.error('Error removing browser profile directory:', error);
        }
        */
        // --- MODIFICATION END ---
        
        if (this.browser) {
            await this.browser.disconnect();
        }
        if (this.managedBrowserProcess) {
            this.managedBrowserProcess.kill();
        }
    }
}

module.exports = BrowserHandler;