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
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { WobblyModel } from '../models/wobbly.js';

/**
 * Wobbly effect: wobbly windows effect for GNOME Shell. Based on the
 * Compiz Wobbly Windows effect.
 *
 * @name WobblyEffect
 * @description Wobbly windows effect for GNOME Shell (similar to the Compiz Wobbly Windows effect).
 * @module effects/wobbly
 */
export class WobblyEffect extends Clutter.DeformEffect {
  static CLUTTER_TIMELINE_DURATION = 1000 * 1000;

  static {
    GObject.registerClass(this);
  }

  /**
   * Constructor for the WobblyEffect class.
   *
   * @constructor
   * @description Constructor for the WobblyEffect class.
   * @param {object} params - Parameters for the effect.
   */
  _init(params = {}) {
    super._init();
    this._destroyed = false;

    this.operationType = params.op;
    this.settingsData = params.settingsData;

    this.paintEvent = null;
    this.moveEvent = null;
    this.newFrameEvent = null;
    this.completedEvent = null;
    this.overviewShowingEvent = null;

    this.timerId = null;
    this.width = 0;
    this.height = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.msecOld = 0;

    this.actorX = 0;
    this.actorY = 0;

    this.wobblyModel = null;
    this.stride = 0;
    this.coeff = null;
    this.deformedX = null;
    this.deformedY = null;
    this.tilesX = 0;
    this.tilesY = 0;
    this.invWidth = 0;
    this.invHeight = 0;
    this.timeAccumulator = 0;

    this.FRICTION = this.settingsData?.FRICTION?.get?.() || 3.5;
    this.SPRING_K = this.settingsData?.SPRING_K?.get?.() || 3.8;
    this.SPEEDUP_FACTOR = this.settingsData?.SPEEDUP_FACTOR?.get?.() || 12.0;
    this.MASS = this.settingsData?.MASS?.get?.() || 70.0;
    this.X_TILES =
      'maximized' === this.operationType
        ? 10
        : this.settingsData?.X_TILES?.get?.() || 6.0;
    this.Y_TILES =
      'maximized' === this.operationType
        ? 10
        : this.settingsData?.Y_TILES?.get?.() || 6.0;
    this.ENABLE_LOGGING = this.settingsData?.ENABLE_LOGGING?.get?.() || false;

    this.set_n_tiles(this.X_TILES, this.Y_TILES);

    this.initialized = false;
    this.ended = false;
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

      [this.width, this.height] = actor.get_size();
      [this.newX, this.newY] = actor.get_position();
      [this.actorX, this.actorY] = [this.newX, this.newY];
      [this.oldX, this.oldY] = [this.newX, this.newY];
      [this.mouseX, this.mouseY] = global.get_pointer();
      [this.tilesX, this.tilesY] = [this.X_TILES + 0.1, this.Y_TILES + 0.1];
      this.invWidth = this.width > 0 ? 1 / this.width : 0;
      this.invHeight = this.height > 0 ? 1 / this.height : 0;

      this.stride = this.X_TILES + 1;
      const numPoints = this.stride * (this.Y_TILES + 1);

      this.coeff = new Float32Array(numPoints * 16);
      this.deformedX = new Float32Array(numPoints);
      this.deformedY = new Float32Array(numPoints);

      let pIdx = 0;
      let cIdx = 0;

      for (let y = 0; y <= this.Y_TILES; y++) {
        const ty = y / this.Y_TILES;
        const ty1 = (1 - ty) ** 3;
        const ty2 = ty * (1 - ty) ** 2;
        const ty3 = ty ** 2 * (1 - ty);
        const ty4 = ty ** 3;

        for (let x = 0; x <= this.X_TILES; x++) {
          const tx = x / this.X_TILES;
          const tx1 = (1 - tx) ** 3;
          const tx2 = tx * (1 - tx) ** 2;
          const tx3 = tx ** 2 * (1 - tx);
          const tx4 = tx ** 3;

          this.coeff[cIdx] = tx1 * ty1;
          this.coeff[cIdx + 1] = 3 * tx2 * ty1;
          this.coeff[cIdx + 2] = 3 * tx3 * ty1;
          this.coeff[cIdx + 3] = tx4 * ty1;
          this.coeff[cIdx + 4] = 3 * tx1 * ty2;
          this.coeff[cIdx + 5] = 9 * tx2 * ty2;
          this.coeff[cIdx + 6] = 9 * tx3 * ty2;
          this.coeff[cIdx + 7] = 3 * tx4 * ty2;
          this.coeff[cIdx + 8] = 3 * tx1 * ty3;
          this.coeff[cIdx + 9] = 9 * tx2 * ty3;
          this.coeff[cIdx + 10] = 9 * tx3 * ty3;
          this.coeff[cIdx + 11] = 3 * tx4 * ty3;
          this.coeff[cIdx + 12] = tx1 * ty4;
          this.coeff[cIdx + 13] = 3 * tx2 * ty4;
          this.coeff[cIdx + 14] = 3 * tx3 * ty4;
          this.coeff[cIdx + 15] = tx4 * ty4;

          this.deformedX[pIdx] = tx * this.width;
          this.deformedY[pIdx] = ty * this.height;

          pIdx++;
          cIdx += 16;
        }
      }

      this.wobblyModel = new WobblyModel({
        friction: this.FRICTION,
        springK: this.SPRING_K,
        mass: this.MASS,
        sizeX: this.width,
        sizeY: this.height,
      });

      if ('unmaximized' === this.operationType) {
        this.wobblyModel.unmaximize();
        this.ended = true;
      } else if ('maximized' === this.operationType) {
        this.wobblyModel.maximize();
        this.ended = true;
      } else {
        this.wobblyModel.grab(this.mouseX - this.newX, this.mouseY - this.newY);
        this.moveEvent = actor.connect(
          'notify::allocation',
          this.on_move_event.bind(this)
        );
      }

      this.overviewShowingEvent = Main.overview?.connect('showing', () =>
        this.destroy()
      );

      this.timerId = new Clutter.Timeline({
        actor: actor,
        duration: WobblyEffect.CLUTTER_TIMELINE_DURATION,
      });

      this.newFrameEvent = this.timerId.connect('new-frame', (timer, msec) =>
        this.on_new_frame_event(timer, msec)
      );

      this.completedEvent = this.timerId.connect('completed', () =>
        this.destroy()
      );
      this.timerId.start();
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

    if (this.overviewShowingEvent) {
      Main.overview?.disconnect(this.overviewShowingEvent);
    }

    if (this.timerId) {
      this.timerId.stop();
      if (this.completedEvent) this.timerId.disconnect(this.completedEvent);
      if (this.newFrameEvent) this.timerId.disconnect(this.newFrameEvent);
      this.timerId = null;
    }

    this.wobblyModel?.dispose();
    this.wobblyModel = null;
    this.coeff = null;
    this.deformedX = null;
    this.deformedY = null;
    this.timeAccumulator = 0;

    const actor = this.get_actor();
    if (actor && !actor.is_destroyed()) {
      if (this.paintEvent) actor.disconnect(this.paintEvent);
      if (this.moveEvent) actor.disconnect(this.moveEvent);
      actor.remove_effect(this);
    }
  }

  /**
   * End the effect.
   *
   * @param {Clutter.Actor} actor
   */
  // eslint-disable-next-line no-unused-vars
  on_end_event(_actor) {
    this.ended = true;
  }

  /**
   * Move the effect.
   *
   * @param {Clutter.Actor} actor
   * @param {Clutter.ActorAllocation} allocation
   * @param {number} flags
   */
  // eslint-disable-next-line no-unused-vars
  on_move_event(actor, _allocation, _flags) {
    if (!actor || actor.is_destroyed() || !this.wobblyModel) return;

    [this.oldX, this.oldY] = [this.newX, this.newY];
    [this.newX, this.newY] = actor.get_position();

    const deltaX = this.newX - this.oldX;
    const deltaY = this.newY - this.oldY;
    this.deltaX -= deltaX;
    this.deltaY -= deltaY;

    this.wobblyModel?.move(deltaX, deltaY);
  }

  /**
   * Update the effect.
   *
   * @param {Clutter.Timeline} timer
   * @param {number} msec
   */
  on_new_frame_event(timer, msec) {
    const actor = this.get_actor();
    if (!actor || actor.is_destroyed()) {
      this.destroy();
      return;
    }

    if (this.ended && !this.wobblyModel?.movement) {
      this.destroy();
      return;
    }

    let numSteps;
    if (this.msecOld > 0) {
      const elapsed = msec - this.msecOld;
      this.timeAccumulator += elapsed / this.SPEEDUP_FACTOR;
      numSteps = Math.floor(this.timeAccumulator);
      if (numSteps > 4) {
        numSteps = 4;
        this.timeAccumulator = 0;
      } else {
        this.timeAccumulator -= numSteps;
      }
    } else {
      numSteps = 1;
    }
    this.msecOld = msec;

    if (numSteps > 0) {
      this.wobblyModel.step(numSteps);
    }

    const obj = this.wobblyModel.objects;
    const coeff = this.coeff;
    const defX = this.deformedX;
    const defY = this.deformedY;
    const totalPoints = this.stride * (this.Y_TILES + 1);

    let cIdx = 0;
    for (let p = 0; p < totalPoints; p++) {
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < 16; i++) {
        const c = coeff[cIdx + i];
        const o = obj[i];
        dx += c * o.x;
        dy += c * o.y;
      }
      defX[p] = dx;
      defY[p] = dy;
      cIdx += 16;
    }

    this.invalidate();
  }

  /**
   * Deform the vertex. Creates a wobbly effect.
   *
   * @param {number} w
   * @param {number} h
   * @param {Clutter.Vertex}
   */
  vfunc_deform_vertex(w, h, v) {
    if (!this.deformedX) return;

    const ix = Math.min(Math.max(0, (v.tx * this.tilesX) >> 0), this.X_TILES);
    const iy = Math.min(Math.max(0, (v.ty * this.tilesY) >> 0), this.Y_TILES);

    const idx = iy * this.stride + ix;
    const x = this.deformedX[idx];
    const y = this.deformedY[idx];

    v.x = (x + this.deltaX) * (w * this.invWidth);
    v.y = (y + this.deltaY) * (h * this.invHeight);
  }
}
