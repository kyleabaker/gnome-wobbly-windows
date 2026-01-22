/*
 * GNOME Wobbly Windows for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 * Copyright (C) 2025
 *     Kyle Baker <https://github.com/kyleabaker/gnome-wobbly-windows>
 *
 * This file is part of the gnome-shell extension gnome-wobbly-windows.
 *
 * gnome-shell extension gnome-wobbly-windows is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension gnome-wobbly-windows is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension gnome-wobbly-windows.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { createSettingsData } from './src/settings/data.js';
import { WobblyEffect } from './src/effects/wobbly.js';
import { ResizeEffect } from './src/effects/resize.js';
import { getMaximizedFlags } from './src/helpers/getMaximized.js';

const EFFECT_NAME = 'gnome-wobbly-windows';

/**
 * Gnome Wobbly Windows extension
 *
 * @name GnomeWobblyWindowsExtension
 * @description Gnome Wobbly Windows extension
 */
export default class GnomeWobblyWindowsExtension extends Extension {
  /**
   * Enables the extension
   */
  enable() {
    this.settingsData = createSettingsData(this.getSettings());

    this.allowedResizeOp = [
      Meta.GrabOp.RESIZING_W,
      Meta.GrabOp.RESIZING_E,
      Meta.GrabOp.RESIZING_S,
      Meta.GrabOp.RESIZING_N,
      Meta.GrabOp.RESIZING_NW,
      Meta.GrabOp.RESIZING_NE,
      Meta.GrabOp.RESIZING_SE,
      Meta.GrabOp.RESIZING_SW,
    ];

    this.grabOpBeginId = null;
    this.grabOpEndId = null;
    this.resizedActor = null;
    this.startResizeOpId = null;
    this.endResizeOpId = null;
    this.destroyId = null;

    this.grabOpBeginId = global.display.connect(
      'grab-op-begin',
      (display, window, op) => {
        if (
          op !== Meta.GrabOp.MOVING &&
          op !== Meta.GrabOp.MOVING_UNCONSTRAINED &&
          (!this.settingsData.RESIZE_EFFECT.get() ||
            !this.allowedResizeOp.includes(op))
        ) {
          return;
        }

        if (!window) {
          return;
        }

        const actor = window.get_compositor_private();
        if (!actor) {
          return;
        }

        this.destroyActorEffect(actor);
        actor.remove_effect_by_name(EFFECT_NAME);

        if (
          Meta.GrabOp.MOVING === op ||
          Meta.GrabOp.MOVING_UNCONSTRAINED === op
        ) {
          actor.add_effect_with_name(
            EFFECT_NAME,
            new WobblyEffect({ settingsData: this.settingsData, op: 'move' })
          );
        } else {
          actor.add_effect_with_name(
            EFFECT_NAME,
            new ResizeEffect({ settingsData: this.settingsData, op: op })
          );
        }
      }
    );

    this.grabOpEndId = global.display.connect(
      'grab-op-end',
      // eslint-disable-next-line no-unused-vars
      (_display, window, _op) => {
        if (!window) {
          return;
        }

        const actor = window.get_compositor_private();
        if (!actor) {
          return;
        }

        const effect = actor.get_effect(EFFECT_NAME);
        if (effect) {
          effect.on_end_event(actor);
        }
      }
    );

    this.startResizeOpId = global.window_manager.connect(
      'size-change',
      // eslint-disable-next-line no-unused-vars
      (_wm, actor, op, _oldFrameRect, _oldBufferRect) => {
        if (!actor || actor.is_destroyed() || !actor.meta_window) {
          return;
        }

        this.resizedActor = actor;
        this.resizedActor.sourceRect = actor.meta_window.get_frame_rect();

        if (op !== Meta.SizeChange.UNMAXIMIZE) {
          return;
        }

        const effect = actor.get_effect(EFFECT_NAME);
        if (!effect || effect.operationType != 'move') {
          this.destroyActorEffect(actor);
          actor.add_effect_with_name(
            EFFECT_NAME,
            new WobblyEffect({
              settingsData: this.settingsData,
              op: 'unmaximized',
            })
          );
        }
      }
    );

    this.endResizeOpId = global.window_manager.connect(
      'size-changed',
      (wm, actor) => {
        // check if the window is resized
        if (
          !actor ||
          actor.is_destroyed() ||
          !this.resizedActor ||
          actor != this.resizedActor ||
          !this.resizedActor.sourceRect ||
          !actor.meta_window
        ) {
          this.resizedActor = null;
          return;
        }

        const sourceRect = this.resizedActor.sourceRect;
        const targetRect = actor.meta_window.get_frame_rect();

        this.resizedActor = null;

        const maximizedFlags = getMaximizedFlags(actor.meta_window);

        // check if the window is maximized
        if (maximizedFlags) {
          this.destroyActorEffect(actor);

          if (!this.settingsData.MAXIMIZE_EFFECT.get()) {
            return;
          }

          const monitor =
            Main.layoutManager.monitors[actor.meta_window.get_monitor()];

          // check if the window is maximized vertically
          if (
            maximizedFlags === Meta.MaximizeFlags.BOTH ||
            (maximizedFlags === Meta.MaximizeFlags.VERTICAL &&
              (sourceRect.y !== targetRect.y ||
                sourceRect.y + sourceRect.height !==
                  targetRect.y + targetRect.height ||
                (sourceRect.x === monitor.x && targetRect.x !== monitor.x) ||
                (sourceRect.x !== monitor.x && targetRect.x === monitor.x) ||
                (sourceRect.x + sourceRect.width ===
                  monitor.x + monitor.width &&
                  targetRect.x + targetRect.width !==
                    monitor.x + monitor.width) ||
                (sourceRect.x + sourceRect.width != monitor.x + monitor.width &&
                  targetRect.x + targetRect.width ===
                    monitor.x + monitor.width)))
          ) {
            actor.add_effect_with_name(
              EFFECT_NAME,
              new WobblyEffect({
                settingsData: this.settingsData,
                op: 'maximized',
              })
            );
          }
        } else {
          // check if the window is moved
          const effect = actor.get_effect(EFFECT_NAME);
          if (effect && 'move' === effect.operationType) {
            this.destroyActorEffect(actor);
            actor.add_effect_with_name(
              EFFECT_NAME,
              new WobblyEffect({ settingsData: this.settingsData, op: 'move' })
            );
          }
        }
      }
    );

    this.destroyId = global.window_manager.connect('destroy', (wm, actor) => {
      this.destroyActorEffect(actor);
    });
  }

  /**
   * Disable the effect.
   */
  disable() {
    if (this.settingsData) {
      this.settingsData = null;
    }
    if (this.resizedActor) {
      this.resizedActor = null;
    }
    if (this.allowedResizeOp) {
      this.allowedResizeOp = null;
    }
    if (this.grabOpBeginId) {
      global.display.disconnect(this.grabOpBeginId);
      this.grabOpBeginId = null;
    }
    if (this.grabOpEndId) {
      global.display.disconnect(this.grabOpEndId);
      this.grabOpEndId = null;
    }
    if (this.endResizeOpId) {
      global.window_manager.disconnect(this.endResizeOpId);
      this.endResizeOpId = null;
    }
    if (this.startResizeOpId) {
      global.window_manager.disconnect(this.startResizeOpId);
      this.startResizeOpId = null;
    }
    if (this.destroyId) {
      global.window_manager.disconnect(this.destroyId);
      this.destroyId = null;
    }

    global.get_window_actors().forEach((actor) => {
      this.destroyActorEffect(actor);
    });
  }

  /**
   * Destroy the actor effect.
   *
   * @param {Clutter.Actor} actor
   */
  destroyActorEffect(actor) {
    if (!actor || actor.is_destroyed()) {
      return;
    }

    const effect = actor.get_effect(EFFECT_NAME);
    if (effect) {
      effect.destroy();
    }
  }
}
