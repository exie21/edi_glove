import { useEffect, useRef, useState } from 'react';

import type { KeyboardState, ManualCommand } from '../types/bridge';

const ZERO_COMMAND: ManualCommand = {
  throttle: 0,
  brake: 0,
  steer: 0,
};

const EMPTY_KEYS: KeyboardState = {
  forward: false,
  brake: false,
  left: false,
  right: false,
  hardBrake: false,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}

function buildCommand(keys: KeyboardState): ManualCommand {
  const throttle = keys.forward ? 1 : 0;
  const brake = keys.hardBrake ? 1 : keys.brake ? 0.7 : 0;
  let steer = 0;
  if (keys.left && !keys.right) {
    steer = -1;
  } else if (keys.right && !keys.left) {
    steer = 1;
  }
  return { throttle, brake, steer };
}

export function useKeyboardDrive(
  enabled: boolean,
  onManualCommand: (command: ManualCommand) => void | Promise<void>,
) {
  const [keyState, setKeyState] = useState<KeyboardState>(EMPTY_KEYS);
  const callbackRef = useRef(onManualCommand);
  const commandRef = useRef<ManualCommand>(ZERO_COMMAND);
  const keysRef = useRef<KeyboardState>(EMPTY_KEYS);

  callbackRef.current = onManualCommand;

  useEffect(() => {
    if (!enabled) {
      keysRef.current = EMPTY_KEYS;
      commandRef.current = ZERO_COMMAND;
      setKeyState(EMPTY_KEYS);
      void callbackRef.current(ZERO_COMMAND);
      return;
    }

    const updateState = (nextKeys: KeyboardState) => {
      keysRef.current = nextKeys;
      const nextCommand = buildCommand(nextKeys);
      commandRef.current = nextCommand;
      setKeyState(nextKeys);
    };

    const resetState = () => {
      updateState(EMPTY_KEYS);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.repeat) {
        return;
      }

      if (
        event.code === 'KeyW' ||
        event.code === 'ArrowUp' ||
        event.code === 'KeyS' ||
        event.code === 'ArrowDown' ||
        event.code === 'KeyA' ||
        event.code === 'ArrowLeft' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowRight' ||
        event.code === 'Space'
      ) {
        event.preventDefault();
      }

      updateState({
        forward: keysRef.current.forward || event.code === 'KeyW' || event.code === 'ArrowUp',
        brake: keysRef.current.brake || event.code === 'KeyS' || event.code === 'ArrowDown',
        left: keysRef.current.left || event.code === 'KeyA' || event.code === 'ArrowLeft',
        right: keysRef.current.right || event.code === 'KeyD' || event.code === 'ArrowRight',
        hardBrake: keysRef.current.hardBrake || event.code === 'Space',
      });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      updateState({
        forward:
          (event.code === 'KeyW' || event.code === 'ArrowUp')
            ? false
            : keysRef.current.forward,
        brake:
          (event.code === 'KeyS' || event.code === 'ArrowDown')
            ? false
            : keysRef.current.brake,
        left:
          (event.code === 'KeyA' || event.code === 'ArrowLeft')
            ? false
            : keysRef.current.left,
        right:
          (event.code === 'KeyD' || event.code === 'ArrowRight')
            ? false
            : keysRef.current.right,
        hardBrake: event.code === 'Space' ? false : keysRef.current.hardBrake,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', resetState);

    const timerId = window.setInterval(() => {
      void callbackRef.current(commandRef.current);
    }, 100);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', resetState);
      window.clearInterval(timerId);
      keysRef.current = EMPTY_KEYS;
      commandRef.current = ZERO_COMMAND;
      setKeyState(EMPTY_KEYS);
      void callbackRef.current(ZERO_COMMAND);
    };
  }, [enabled]);

  return {
    keyState,
    manualCommand: commandRef.current,
  };
}
