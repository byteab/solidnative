/** @jsxImportSource solid-js */
/**
 * The hero: the claim, and one Solid component running on both platforms.
 *
 * The phones are three apps, fanned - `examples/vault`, `player` and `fitness` - each a screenshot
 * of real native views on the iOS simulator or the Android emulator. The pointer tilts the fan by
 * a few degrees at most; not on touch, and not under reduced motion.
 */
import { For } from 'solid-js';
import { SITE_NAME } from '../site.ts';
import { LandingCommand } from './command.tsx';
import { CREATE_COMMAND, LINKS, STATUS } from './content.ts';
import { prefersReducedMotion, underline } from './ink.ts';
import { LandingPhone, type DevicePlatform } from './phone.tsx';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-hero': HTMLAttributes<HTMLElement>;
    }
  }
}

/** The sponsor, tagged so their analytics can tell a visit came from here. */
const SPONSOR_URL =
  'https://coralogix.com/?utm_source=solidnative&utm_medium=referral&utm_campaign=solidnative';

const PHONES: readonly {
  slot: 'left' | 'centre' | 'right';
  platform: DevicePlatform;
  shot: string;
  alt: string;
}[] = [
  {
    slot: 'left',
    platform: 'ios',
    shot: 'vault',
    alt: 'A dark banking app home screen, with a gradient card and a week of spending, on iOS',
  },
  {
    slot: 'centre',
    platform: 'ios',
    shot: 'player',
    alt: 'A music player with drawn sunset album art, a scrubber and playback controls, on iOS',
  },
  {
    slot: 'right',
    platform: 'android',
    shot: 'fitness',
    alt: 'A fitness summary with activity rings and a map of an evening run, on Android',
  },
];

const HEADLINE_RULE = underline(0, 6, 100, 11);

export function LandingHero() {
  const links = LINKS;
  let devices!: HTMLDivElement;

  /**
   * Whether the load sequence runs. Never under reduced motion, where everything is drawn - and
   * not if the page has already painted: that is the prerendered copy, which played the sequence
   * itself on first paint, and the client taking over must not play it a second time.
   */
  const intro =
    !prefersReducedMotion() &&
    !performance.getEntriesByType('paint').some((entry) => entry.name === 'first-contentful-paint');

  function tilt(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const box = devices.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    devices.style.setProperty('--tx', `${(x * 6).toFixed(2)}deg`);
    devices.style.setProperty('--ty', `${(-y * 4).toFixed(2)}deg`);
  }

  function level(): void {
    devices.style.setProperty('--tx', '0deg');
    devices.style.setProperty('--ty', '0deg');
  }

  return (
    <landing-hero>
      <section
        class="relative mx-auto max-w-[80rem] px-[var(--gutter)] pt-10 pb-20 lg:pt-16"
        classList={{ 'hero-intro': intro }}
        aria-labelledby="hero-title"
      >
        <div class="grid items-center gap-x-8 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ============================================================ The claim */}
          <div class="relative z-10 min-w-0 lg:pt-8">
            <p class="landing-eyebrow hero-rise flex items-center gap-3" style="--i: 0">
              <span>{SITE_NAME}</span>
              <span aria-hidden="true">·</span>
              <span>Now in {STATUS.stage}</span>
            </p>
            <h1 id="hero-title" class="landing-display mt-5 text-[clamp(2.7rem,5vw,4.5rem)]">
              <span class="hero-rise block whitespace-nowrap" style="--i: 1">
                Build native apps
              </span>
              <span class="hero-rise block" style="--i: 2">
                with{' '}
                <span class="relative inline-block">
                  Solid.
                  <svg
                    class="absolute -bottom-[0.12em] left-0 h-[0.2em] w-full overflow-visible"
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path class="ink-accent ink-stretch hero-thread" d={HEADLINE_RULE} />
                  </svg>
                </span>
              </span>
            </h1>
            <p class="landing-prose hero-rise mt-7" style="--i: 3">
              Solid components that render as real <code>UIView</code> and{' '}
              <code>android.view.View</code>, built and shipped with Expo. Write JSX, signals and
              effects as you do on the web, and style them with CSS and Tailwind.
            </p>

            <div class="hero-rise mt-8 flex flex-wrap items-center gap-3" style="--i: 4">
              <a class="landing-button" data-kind="primary" href={links.getStarted}>
                Get started
                <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
                  <path
                    d="M3 8h9.5M9 4.5 12.5 8 9 11.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a>
              <a class="landing-button" data-kind="secondary" href={links.github}>
                View on GitHub
              </a>
            </div>

            <LandingCommand
              class="hero-rise mt-6 max-w-[34rem]"
              style="--i: 5"
              command={CREATE_COMMAND}
            />
            <p class="hero-rise mt-3 text-sm text-graphite" style="--i: 6">
              Solid {STATUS.solid} · Expo {STATUS.expo} · iOS and Android
            </p>
          </div>

          {/* ============================================================ The proof */}
          {/*
            Three apps, fanned: a bank, a music player, a fitness tracker. Each phone is a capture
            of one of src/examples, running as real native views - two on the iOS simulator, one
            on the Android emulator - and the caption says which.
          */}
          <figure class="relative min-w-0">
            <div ref={devices} class="hero-fan" onPointerMove={tilt} onPointerLeave={level}>
              <div class="hero-glow" aria-hidden="true" />
              <div class="hero-fan-inner">
                <For each={PHONES}>
                  {(phone) => (
                    <LandingPhone
                      class="hero-phone"
                      slot={phone.slot}
                      platform={phone.platform}
                      shot={phone.shot}
                      alt={phone.alt}
                      eager
                    />
                  )}
                </For>
              </div>
            </div>
            <figcaption class="hero-fan-caption">
              Real screenshots · iOS simulator and Android emulator
            </figcaption>
          </figure>
        </div>
        <div class="mx-auto max-w-[80rem] px-[var(--gutter)] pt-14 text-center">
          <p class="text-sm text-graphite">Sponsored by</p>
          <a
            class="mt-5 inline-flex text-ink/45 transition-colors hover:text-ink/80"
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener"
            aria-label="Coralogix"
          >
            <svg class="h-8 w-auto" viewBox="0 0 358 86" fill="none" aria-hidden="true">
              <path
                d="M73.9999 41C73.9999 57.0162 61.0162 70 44.9999 70C28.9838 70 16 57.0162 16 41C16 24.9837 28.9838 12 44.9999 12C61.0162 12 73.9999 24.9837 73.9999 41Z"
                fill="currentColor"
                opacity="0.45"
              />
              <path
                d="M66.463 40.9815C66.463 52.8454 56.8454 62.463 44.9815 62.463C33.1176 62.463 23.5 52.8454 23.5 40.9815C23.5 29.1175 33.1176 19.5 44.9815 19.5C56.8454 19.5 66.463 29.1175 66.463 40.9815Z"
                fill="currentColor"
              />
              <path
                d="M109.102 62.5741C106.099 62.5741 103.322 62.0299 100.77 60.9416C98.2556 59.8532 96.0413 58.3333 94.1273 56.3818C92.2509 54.4302 90.7872 52.1409 89.7364 49.5139C88.6856 46.8868 88.1602 44.0158 88.1602 40.9009C88.1602 37.7859 88.6668 34.9149 89.6801 32.2879C90.7309 29.6233 92.1946 27.334 94.071 25.42C95.985 23.4685 98.218 21.9673 100.77 20.9165C103.322 19.8281 106.099 19.2839 109.102 19.2839C112.104 19.2839 114.787 19.7906 117.152 20.8039C119.554 21.8172 121.58 23.1682 123.231 24.8571C124.883 26.5083 126.065 28.3285 126.778 30.3176L119.91 33.5264C119.122 31.4247 117.79 29.6984 115.913 28.3473C114.037 26.9587 111.766 26.2644 109.102 26.2644C106.475 26.2644 104.148 26.8836 102.121 28.1221C100.132 29.3606 98.5746 31.0682 97.4487 33.2449C96.3603 35.4216 95.8162 37.9736 95.8162 40.9009C95.8162 43.8282 96.3603 46.3989 97.4487 48.6132C98.5746 50.7899 100.132 52.4975 102.121 53.7359C104.148 54.9744 106.475 55.5937 109.102 55.5937C111.766 55.5937 114.037 54.9181 115.913 53.5671C117.79 52.1785 119.122 50.4334 119.91 48.3317L126.778 51.5405C126.065 53.5295 124.883 55.3685 123.231 57.0573C121.58 58.7086 119.554 60.0409 117.152 61.0542C114.787 62.0675 112.104 62.5741 109.102 62.5741Z"
                fill="currentColor"
              />
              <path
                d="M145.56 62.5741C142.558 62.5741 139.818 61.8798 137.341 60.4912C134.902 59.1027 132.95 57.2074 131.487 54.8055C130.061 52.4036 129.348 49.664 129.348 46.5866C129.348 43.5092 130.061 40.7695 131.487 38.3676C132.95 35.9658 134.902 34.0705 137.341 32.6819C139.781 31.2933 142.52 30.5991 145.56 30.5991C148.563 30.5991 151.284 31.2933 153.723 32.6819C156.162 34.0705 158.095 35.9658 159.521 38.3676C160.985 40.732 161.717 43.4716 161.717 46.5866C161.717 49.664 160.985 52.4036 159.521 54.8055C158.058 57.2074 156.106 59.1027 153.667 60.4912C151.227 61.8798 148.525 62.5741 145.56 62.5741ZM145.56 55.8188C147.212 55.8188 148.657 55.4248 149.895 54.6366C151.171 53.8485 152.166 52.7602 152.879 51.3716C153.629 49.9455 154.004 48.3505 154.004 46.5866C154.004 44.7852 153.629 43.2089 152.879 41.8579C152.166 40.4693 151.171 39.3809 149.895 38.5928C148.657 37.7672 147.212 37.3544 145.56 37.3544C143.872 37.3544 142.389 37.7672 141.113 38.5928C139.837 39.3809 138.824 40.4693 138.073 41.8579C137.36 43.2089 137.004 44.7852 137.004 46.5866C137.004 48.3505 137.36 49.9455 138.073 51.3716C138.824 52.7602 139.837 53.8485 141.113 54.6366C142.389 55.4248 143.872 55.8188 145.56 55.8188Z"
                fill="currentColor"
              />
              <path
                d="M166.071 61.8986V31.2746H172.995V38.0862L172.432 37.0729C173.145 34.7836 174.252 33.1886 175.753 32.2879C177.292 31.3872 179.131 30.9368 181.27 30.9368H183.072V37.4669H180.426C178.324 37.4669 176.635 38.1237 175.359 39.4372C174.083 40.7132 173.445 42.5146 173.445 44.8415V61.8986H166.071Z"
                fill="currentColor"
              />
              <path
                d="M195.176 62.5741C193.037 62.5741 191.179 62.2176 189.603 61.5045C188.027 60.7915 186.807 59.7782 185.944 58.4647C185.081 57.1136 184.649 55.5561 184.649 53.7922C184.649 52.1034 185.024 50.6022 185.775 49.2887C186.526 47.9376 187.689 46.8118 189.265 45.9111C190.842 45.0104 192.831 44.3724 195.232 43.9971L205.253 42.3645V47.9939L196.64 49.4576C195.176 49.7203 194.088 50.1894 193.375 50.8649C192.662 51.5405 192.305 52.4224 192.305 53.5108C192.305 54.5616 192.699 55.406 193.487 56.044C194.313 56.6445 195.326 56.9447 196.527 56.9447C198.066 56.9447 199.417 56.6257 200.58 55.9877C201.781 55.3122 202.701 54.3927 203.339 53.2293C204.014 52.0659 204.352 50.7899 204.352 49.4013V41.5201C204.352 40.2066 203.827 39.1182 202.776 38.2551C201.763 37.3544 200.412 36.904 198.723 36.904C197.146 36.904 195.739 37.3356 194.501 38.1988C193.3 39.0244 192.418 40.1315 191.855 41.5201L185.831 38.5928C186.432 36.9791 187.37 35.5905 188.646 34.4271C189.96 33.2261 191.498 32.2879 193.262 31.6123C195.026 30.9368 196.94 30.5991 199.004 30.5991C201.519 30.5991 203.733 31.0682 205.647 32.0064C207.561 32.9071 209.043 34.1831 210.094 35.8344C211.182 37.4482 211.727 39.3434 211.727 41.5201V61.8986H204.746V56.6632L206.322 56.5507C205.534 57.8642 204.596 58.9713 203.508 59.872C202.419 60.7352 201.181 61.4107 199.792 61.8986C198.404 62.3489 196.865 62.5741 195.176 62.5741Z"
                fill="currentColor"
              />
              <path d="M217.304 61.8986V19.2839H224.679V61.8986H217.304Z" fill="currentColor" />
              <path
                d="M245.223 62.5741C242.221 62.5741 239.481 61.8798 237.004 60.4912C234.565 59.1027 232.614 57.2074 231.15 54.8055C229.724 52.4036 229.011 49.664 229.011 46.5866C229.011 43.5092 229.724 40.7695 231.15 38.3676C232.614 35.9658 234.565 34.0705 237.004 32.6819C239.444 31.2933 242.184 30.5991 245.223 30.5991C248.226 30.5991 250.947 31.2933 253.386 32.6819C255.825 34.0705 257.758 35.9658 259.184 38.3676C260.648 40.732 261.38 43.4716 261.38 46.5866C261.38 49.664 260.648 52.4036 259.184 54.8055C257.721 57.2074 255.769 59.1027 253.33 60.4912C250.89 61.8798 248.188 62.5741 245.223 62.5741ZM245.223 55.8188C246.875 55.8188 248.32 55.4248 249.558 54.6366C250.834 53.8485 251.829 52.7602 252.542 51.3716C253.292 49.9455 253.668 48.3505 253.668 46.5866C253.668 44.7852 253.292 43.2089 252.542 41.8579C251.829 40.4693 250.834 39.3809 249.558 38.5928C248.32 37.7672 246.875 37.3544 245.223 37.3544C243.535 37.3544 242.052 37.7672 240.776 38.5928C239.5 39.3809 238.487 40.4693 237.736 41.8579C237.023 43.2089 236.667 44.7852 236.667 46.5866C236.667 48.3505 237.023 49.9455 237.736 51.3716C238.487 52.7602 239.5 53.8485 240.776 54.6366C242.052 55.4248 243.535 55.8188 245.223 55.8188Z"
                fill="currentColor"
              />
              <path
                d="M280.595 74.2833C278.306 74.2833 276.186 73.908 274.234 73.1574C272.283 72.4068 270.594 71.356 269.168 70.0049C267.779 68.6914 266.766 67.1339 266.128 65.3325L272.996 62.743C273.446 64.1691 274.328 65.3138 275.642 66.1769C276.993 67.0777 278.644 67.528 280.595 67.528C282.097 67.528 283.41 67.2465 284.536 66.6836C285.699 66.1207 286.6 65.295 287.238 64.2066C287.876 63.1558 288.195 61.8798 288.195 60.3787V53.3982L289.603 55.087C288.552 56.9259 287.144 58.3145 285.38 59.2528C283.617 60.191 281.609 60.6601 279.357 60.6601C276.505 60.6601 273.953 60.0034 271.701 58.6898C269.449 57.3763 267.685 55.5749 266.409 53.2856C265.133 50.9963 264.495 48.4255 264.495 45.5733C264.495 42.6835 265.133 40.1128 266.409 37.861C267.685 35.6092 269.43 33.8454 271.645 32.5693C273.859 31.2558 276.373 30.5991 279.188 30.5991C281.477 30.5991 283.485 31.0869 285.212 32.0627C286.975 33.0009 288.439 34.3708 289.603 36.1722L288.589 38.0299V31.2746H295.57V60.3787C295.57 63.0432 294.913 65.4264 293.599 67.528C292.323 69.6297 290.56 71.2809 288.308 72.4819C286.094 73.6828 283.523 74.2833 280.595 74.2833ZM280.258 53.8485C281.834 53.8485 283.204 53.5108 284.367 52.8352C285.568 52.1222 286.506 51.1464 287.182 49.9079C287.857 48.6695 288.195 47.2434 288.195 45.6296C288.195 44.0534 287.839 42.646 287.126 41.4075C286.45 40.1315 285.512 39.137 284.311 38.4239C283.147 37.7109 281.796 37.3544 280.258 37.3544C278.719 37.3544 277.33 37.7109 276.092 38.4239C274.853 39.137 273.878 40.1315 273.165 41.4075C272.489 42.646 272.151 44.0534 272.151 45.6296C272.151 47.2058 272.489 48.6132 273.165 49.8516C273.878 51.0901 274.835 52.0659 276.036 52.7789C277.274 53.492 278.681 53.8485 280.258 53.8485Z"
                fill="currentColor"
              />
              <path
                d="M301.218 61.8986V31.2746H308.593V61.8986H301.218ZM301.218 27.8406V19.9595H308.593V27.8406H301.218Z"
                fill="currentColor"
              />
              <path
                d="M311.405 61.8986L322.101 46.5303L311.349 31.2746H320.018L328.406 43.6593H324.522L332.909 31.2746H341.522L330.827 46.5303L341.466 61.8986H332.853L324.578 49.5702H328.35L320.074 61.8986H311.405Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>
      </section>
    </landing-hero>
  );
}
