/** @jsxImportSource solid-js */
'use dom';
import { createEffect, onCleanup, onMount } from 'solid-js';
import { mountInWebView } from '@solid-native/web/solid/web-view';
import { signatureStyle } from './signature-style.solid.ts';

interface SignatureProps {
  name?: string;
  ink?: string;
  onStrokes?: (count: number) => void;
  onCleared?: () => void;
}

/** The original canvas and browser CSS stay within the separate embedded page. */
export function Signature(props: SignatureProps) {
  let pad!: HTMLCanvasElement;
  let drawing = false;
  let count = 0;
  let active = true;
  const context = () => pad.getContext('2d')!;
  onMount(() => {
    const scale = window.devicePixelRatio;
    pad.width = pad.clientWidth * scale;
    pad.height = pad.clientHeight * scale;
    context().scale(scale, scale);
    context().lineWidth = 2.5;
    context().lineCap = 'round';
  });
  createEffect(() => {
    context().strokeStyle = props.ink ?? '#1c1c1e';
  });
  onCleanup(() => {
    active = false;
    drawing = false;
  });
  const start = (event: PointerEvent) => {
    if (!active) return;
    drawing = true;
    context().beginPath();
    context().moveTo(event.offsetX, event.offsetY);
  };
  const draw = (event: PointerEvent) => {
    if (!active || !drawing) return;
    context().lineTo(event.offsetX, event.offsetY);
    context().stroke();
  };
  const finish = () => {
    if (!active || !drawing) return;
    drawing = false;
    props.onStrokes?.(++count);
  };
  const clear = () => {
    if (!active) return;
    context().clearRect(0, 0, pad.width, pad.height);
    drawing = false;
    count = 0;
    props.onCleared?.();
  };
  return (
    <div class="signature">
      <style>{signatureStyle}</style>
      <canvas ref={pad} onPointerDown={start} onPointerMove={draw} onPointerUp={finish} />
      <div class="bar">
        <span>Sign as {props.name ?? ''}</span>
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

export default mountInWebView(Signature, {
  inputs: { name: '', ink: '#1c1c1e' },
  outputs: { strokes: 'onStrokes', cleared: 'onCleared' },
});
