/*
 * GNOME Wobbly Windows for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 * Copyright (C) 2025
 *     Kyle Baker <https://github.com/kyleabaker/gnome-wobbly-windows>
 *
 * This file is part of the gnome-shell extension GNOME Wobbly Windows.
 *
 * gnome-shell extension GNOME Wobbly Windows is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension GNOME Wobbly Windows is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension GNOME Wobbly Windows.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';

const pow2 = (x) => x * x;

/**
 * Resize Effect: Resize Effect for GNOME Shell. Renders a window resize effect for wobbly windows effect for GNOME Shell.
 *
 * @name ResizeEffect
 * @description Resize Effect for GNOME Shell. Renders a window resize effect for wobbly windows effect for GNOME Shell.
 * @module effects/resize
 */
export class ResizeEffect extends Clutter.DeformEffect {
  static {
    GObject.registerClass(this);
  }

  /**
   * Constructor for the ResizeEffect class.
   *
   * @constructor
   * @description Constructor for the ResizeEffect class.
   * @param {object} params - Parameters for the effect.
   */
  _init(params = {}) {
    super._init();
    this.operationType = params.op;
    this.settingsData = params.settingsData;

    this.CLUTTER_TIMELINE_END_RESIZE_EFFECT_DURATION = 1000;

    this.paintEvent = null;
    this.moveEvent = null;
    this.newFrameEvent = null;
    this.completedEvent = null;

    this.xPickedUp = 0;
    this.yPickedUp = 0;
    this.xNew = 0;
    this.yNew = 0;
    this.xOld = 0;
    this.yOld = 0;
    this.xDelta = 0;
    this.yDelta = 0;
    this.msecOld = 0;
    this.xDeltaStop = 0;
    this.yDeltaStop = 0;
    this.timerId = null;

    this.END_EFFECT_MULTIPLIER = this.settingsData.FRICTION.get() * 10 + 10;
    this.END_EFFECT_DIVIDER = 4;
    this.X_MULTIPLIER = this.Y_MULTIPLIER =
      (this.settingsData.SPRING_K.get() * 2) / 10;
    this.CORNER_RESIZING_DIVIDER = 6;

    this.X_TILES = this.settingsData?.X_TILES?.get?.() || 6.0;
    this.Y_TILES = this.settingsData?.Y_TILES?.get?.() || 6.0;

    this._lastW = 0;
    this._lastH = 0;
    this._lastXDelta = 0;
    this._lastYDelta = 0;
    this._dxFactor = 0;
    this._dyFactor = 0;
    this._dxCornerFactor = 0;
    this._dyCornerFactor = 0;

    this.ENABLE_LOGGING = this.settingsData?.ENABLE_LOGGING?.get?.() || false;

    this.set_n_tiles(this.X_TILES, this.Y_TILES);

    this.initialized = false;
    this._destroyed = false;
  }

  /**
   * Set the actor for the effect.
   *
   * @param {Clutter.Actor} actor
   */
  vfunc_set_actor(actor) {
    super.vfunc_set_actor(actor);

    if (actor && !this.initialized) {
      this.initialized = true;

      [this.xNew, this.yNew] = global.get_pointer();
      const [xWin, yWin] = actor.get_position();

      [this.xOld, this.yOld] = [this.xNew, this.yNew];
      [this.xPickedUp, this.yPickedUp] = [this.xNew - xWin, this.yNew - yWin];

      this.moveEvent = actor.connect('notify::allocation', () =>
        this.on_move_event(actor)
      );
    }
  }

  /**
   * Modify the paint volume for the effect.
   *
   * @param {Clutter.PaintVolume} pv
   */
  // eslint-disable-next-line no-unused-vars
  vfunc_modify_paint_volume(_pv) {
    return false;
  }

  /**
   * Destroy the effect.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this.timerId) {
      this.timerId.stop();
      if (this.completedEvent) this.timerId.disconnect(this.completedEvent);
      if (this.newFrameEvent) this.timerId.disconnect(this.newFrameEvent);
      this.timerId = null;
    }

    const actor = this.get_actor();
    if (actor && !actor.is_destroyed()) {
      if (this.paintEvent) {
        actor.disconnect(this.paintEvent);
        this.paintEvent = null;
      }
      if (this.moveEvent) {
        actor.disconnect(this.moveEvent);
        this.moveEvent = null;
      }
      actor.remove_effect(this);
    }
  }

  /**
   * End the effect.
   *
   * @param {Clutter.Actor} actor
   */
  on_end_event(actor) {
    [this.xDeltaStop, this.yDeltaStop] = [this.xDelta * 1.5, this.yDelta * 1.5];

    this.timerId = new Clutter.Timeline({
      actor,
      duration: this.CLUTTER_TIMELINE_END_RESIZE_EFFECT_DURATION,
    });

    this.newFrameEvent = this.timerId.connect('new-frame', (t, m) =>
      this.on_stop_effect_event(t, m)
    );
    this.completedEvent = this.timerId.connect('completed', () =>
      this.destroy()
    );
    this.timerId.start();
  }

  /**
   * Stop the effect.
   *
   * @param {Clutter.Timeline} timer
   * @param {number} msec
   */
  // eslint-disable-next-line no-unused-vars
  on_stop_effect_event(timer, _msec) {
    const progress = timer.get_progress();

    // easeOutCubic: f(t) = 1 - (1 - t)^3
    const eased = 1 - Math.pow(1 - progress, 3);
    const oscillation = progress * this.END_EFFECT_MULTIPLIER;

    this.xDelta = Math.trunc(this.xDeltaStop * eased * Math.sin(oscillation));
    this.yDelta = Math.trunc(this.yDeltaStop * eased * Math.sin(oscillation));

    this.invalidate();
  }

  /**
   * Move the effect.
   *
   * @param {Clutter.Actor} actor
   */
  // eslint-disable-next-line no-unused-vars
  on_move_event(_actor) {
    const [xPointer, yPointer] = global.get_pointer();

    this.xDelta += (this.xOld - xPointer) * this.X_MULTIPLIER;
    this.yDelta += (this.yOld - yPointer) * this.Y_MULTIPLIER;

    [this.xOld, this.yOld] = [xPointer, yPointer];
  }

  /**
   * Deform the vertex. Creates a wobbly effect.
   *
   * @param {number} w
   * @param {number} h
   * @param {Clutter.Vertex}
   */
  vfunc_deform_vertex(w, h, v) {
    if (
      this._lastW !== w ||
      this._lastH !== h ||
      this._lastXDelta !== this.xDelta ||
      this._lastYDelta !== this.yDelta
    ) {
      this._lastW = w;
      this._lastH = h;
      this._lastXDelta = this.xDelta;
      this._lastYDelta = this.yDelta;

      const invH2W = h > 0 && w > 0 ? 1 / (h * h * w) : 0;
      const invW2H = w > 0 && h > 0 ? 1 / (w * w * h) : 0;

      this._dxFactor = this.xDelta * invH2W;
      this._dyFactor = this.yDelta * invW2H;
      this._dxCornerFactor =
        (this.xDelta / this.CORNER_RESIZING_DIVIDER) * invH2W;
      this._dyCornerFactor =
        (this.yDelta / this.CORNER_RESIZING_DIVIDER) * invW2H;
    }

    const op = this.operationType;

    switch (op) {
      case Meta.GrabOp.RESIZING_W:
        v.x += (w - v.x) * pow2(v.y - this.yPickedUp) * this._dxFactor;
        break;

      case Meta.GrabOp.RESIZING_E:
        v.x += v.x * pow2(v.y - this.yPickedUp) * this._dxFactor;
        break;

      case Meta.GrabOp.RESIZING_S:
        v.y += v.y * pow2(v.x - this.xPickedUp) * this._dyFactor;
        break;

      case Meta.GrabOp.RESIZING_N:
        v.y += (h - v.y) * pow2(v.x - this.xPickedUp) * this._dyFactor;
        break;

      case Meta.GrabOp.RESIZING_NW:
        v.x += (w - v.x) * pow2(v.y) * this._dxCornerFactor;
        v.y += (h - v.y) * pow2(v.x) * this._dyCornerFactor;
        break;

      case Meta.GrabOp.RESIZING_NE:
        v.x += v.x * pow2(v.y) * this._dxCornerFactor;
        v.y += (h - v.y) * pow2(w - v.x) * this._dyCornerFactor;
        break;

      case Meta.GrabOp.RESIZING_SE:
        v.x += v.x * pow2(h - v.y) * this._dxCornerFactor;
        v.y += v.y * pow2(w - v.x) * this._dyCornerFactor;
        break;

      case Meta.GrabOp.RESIZING_SW:
        v.x += (w - v.x) * pow2(v.y - h) * this._dxCornerFactor;
        v.y += v.y * pow2(v.x) * this._dyCornerFactor;
        break;
    }
  }
}
