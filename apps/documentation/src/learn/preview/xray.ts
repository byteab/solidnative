/**
 * X-ray: a box around every element the learner's components made, labelled with the native view
 * it would be on a device: the element `<Text>` renders is a `Paragraph`, `<Pressable>`'s a `View`.
 *
 * Drawn as a layer over the phone rather than as attributes or pseudo-elements on the elements
 * themselves, so turning it on cannot change the layout, the styles or anything a test reads.
 * The names come from `@solid-native/fabric`'s own `viewNameOf`, so they are what the engine
 * commits, not a copy of its table.
 */
import { viewNameOf } from '@solid-native/fabric';
import { nodeOf } from '@solid-native/web/solid';

export class Xray {
  private readonly layer: HTMLElement;
  private readonly observer = new MutationObserver(() => this.schedule());
  private on = false;
  private frame = 0;
  private readonly root: () => Element | undefined;

  constructor(root: () => Element | undefined) {
    this.root = root;
    this.layer = document.createElement('div');
    this.layer.className = 'xray';
    this.layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.layer);
    addEventListener('resize', () => this.schedule());
    addEventListener('scroll', () => this.schedule(), true);
  }

  set(on: boolean): void {
    this.on = on;
    this.observer.disconnect();
    const root = this.root();
    if (on && root) {
      this.observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
    this.schedule();
  }

  /** The app was replaced: watch the new one. */
  refresh(): void {
    this.set(this.on);
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    this.layer.replaceChildren();
    const root = this.root();
    if (!this.on || !root) return;
    // A component's element and the first thing in its template often share a corner; their
    // labels stack rather than one hiding the other.
    const corners = new Map<string, number>();
    for (const el of root.querySelectorAll('*')) {
      const node = nodeOf(el);
      if (!node || node.kind !== 'element' || node.el !== el) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      const box = document.createElement('div');
      box.className = 'xray-box';
      box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
      const label = document.createElement('span');
      label.textContent = `${node.name} ${viewNameOf(node)}`;
      const corner = `${Math.round(rect.left)},${Math.round(rect.top)}`;
      const stacked = corners.get(corner) ?? 0;
      corners.set(corner, stacked + 1);
      label.style.top = `${stacked * 13}px`;
      box.appendChild(label);
      this.layer.appendChild(box);
    }
  }
}
