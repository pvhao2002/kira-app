import path from 'node:path';
import { chromium } from 'patchright';
import { log } from '../log.js';
import { ORIGIN, isVerificationRequired } from './fetch-client.js';

/**
 * One persistent Patchright context per lane. A persistent profile keeps a legitimately-earned
 * Cloudflare clearance cookie alive across lane re-inits/restarts. No UA / extra-header overrides:
 * Patchright relies on the real Chrome fingerprint. `browserType` is injectable for tests.
 */
export class Lane {
  #tail = Promise.resolve();
  #context = null;
  #page = null;

  constructor(laneType, props, browserType = chromium) {
    this.laneType = laneType;
    this.props = props;
    this.browserType = browserType;
  }

  /** Serialized access to the page (promise-chain mutex). */
  withPage(action) {
    const run = this.#tail.then(async () => {
      await this.ensureReady();
      try {
        return await action(this.#page);
      } catch (e) {
        if (isVerificationRequired(e)) {
          log.warn(
            `Cloudflare verification required for instance ${this.props.profileInstanceId}, lane ${this.laneType}; `
              + 'keep this browser profile open for remote verification',
          );
        }
        throw e;
      }
    });
    this.#tail = run.catch(() => {});
    return run;
  }

  async ensureReady() {
    if (this.#page && !this.#page.isClosed()) return;
    if (this.#page || this.#context) {
      log.warn(`Browser lane ${this.laneType} page unavailable; reinitializing`);
      await this.#tearDown();
    }
    await this.#init();
  }

  async #init() {
    const dir = path.join(this.props.profileBaseDir, this.props.profileInstanceId, this.laneType);
    const context = await this.browserType.launchPersistentContext(dir, {
      headless: this.props.headless,
      channel: this.props.channel,
      viewport: null,
    });
    try {
      const pages = context.pages();
      const page = pages.length === 0 ? await context.newPage() : pages[0];
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      this.#context = context;
      this.#page = page;
    } catch (e) {
      try {
        await context.close();
      } catch {
        /* closing a half-open context */
      }
      throw e;
    }
    log.info(`Browser lane ${this.laneType} opened (headless=${this.props.headless}, profileDir=${dir}); Cloudflare clearance is checked before API requests`);
  }

  async #tearDown() {
    const page = this.#page;
    const context = this.#context;
    this.#page = null;
    this.#context = null;
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }

  /** Waits for in-flight work, then releases the browser. */
  async close() {
    const run = this.#tail.then(() => this.#tearDown());
    this.#tail = run.catch(() => {});
    await run;
  }
}

export class BrowserManager {
  #lanes = new Map();

  constructor(props, browserType = chromium) {
    this.props = props;
    this.browserType = browserType;
  }

  getLane(name) {
    if (!this.#lanes.has(name)) this.#lanes.set(name, new Lane(name, this.props, this.browserType));
    return this.#lanes.get(name);
  }

  async closeAllLanes() {
    const lanes = [...this.#lanes.values()];
    this.#lanes.clear();
    await Promise.allSettled(lanes.map((l) => l.close()));
  }
}
