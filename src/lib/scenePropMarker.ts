import type { SceneObjectKind } from '../types/ui';

function createSpan(className: string, textContent?: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

function buildBarrelVisual(): HTMLSpanElement {
  const visual = createSpan('scene-prop-marker__visual scene-prop-marker__visual--barrel');
  const top = createSpan('scene-prop-marker__barrel-top');
  const body = createSpan('scene-prop-marker__barrel-body');
  const bandTop = createSpan('scene-prop-marker__barrel-band scene-prop-marker__barrel-band--top');
  const bandBottom = createSpan('scene-prop-marker__barrel-band scene-prop-marker__barrel-band--bottom');
  const base = createSpan('scene-prop-marker__barrel-base');

  body.append(bandTop, bandBottom);
  visual.append(top, body, base);
  return visual;
}

function buildTrafficLightVisual(): HTMLSpanElement {
  const visual = createSpan(
    'scene-prop-marker__visual scene-prop-marker__visual--traffic-light',
  );
  const pole = createSpan('scene-prop-marker__traffic-pole');
  const arm = createSpan('scene-prop-marker__traffic-arm');
  const head = createSpan('scene-prop-marker__traffic-head');
  const red = createSpan('scene-prop-marker__traffic-lens scene-prop-marker__traffic-lens--red');
  const yellow = createSpan('scene-prop-marker__traffic-lens scene-prop-marker__traffic-lens--yellow');
  const green = createSpan('scene-prop-marker__traffic-lens scene-prop-marker__traffic-lens--green');

  head.append(red, yellow, green);
  visual.append(pole, arm, head);
  return visual;
}

function buildStopSignVisual(): HTMLSpanElement {
  const visual = createSpan(
    'scene-prop-marker__visual scene-prop-marker__visual--stop-sign',
  );
  const post = createSpan('scene-prop-marker__stop-post');
  const face = createSpan('scene-prop-marker__stop-face');
  const text = createSpan('scene-prop-marker__stop-text', 'STOP');
  const stopbar = createSpan('scene-prop-marker__stopbar');

  face.append(text);
  visual.append(post, face, stopbar);
  return visual;
}

export function createScenePropMarkerElement(
  kind: SceneObjectKind,
  label: string,
): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `scene-prop-marker scene-prop-marker--${kind}`;
  element.setAttribute('aria-label', `${label} ${kind.replace('_', ' ')}`);

  const stack = createSpan('scene-prop-marker__stack');
  const yawGroup = createSpan('scene-prop-marker__yaw');
  const shadow = createSpan('scene-prop-marker__shadow');
  const labelTag = createSpan('scene-prop-marker__tag', label);

  yawGroup.append(shadow);
  yawGroup.append(
    kind === 'barrel'
      ? buildBarrelVisual()
      : kind === 'stop_sign'
        ? buildStopSignVisual()
        : buildTrafficLightVisual(),
  );
  stack.append(yawGroup);
  stack.append(labelTag);
  element.append(stack);

  return element;
}
