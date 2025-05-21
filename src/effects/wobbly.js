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
    this.coeff = [];
    this.deformedObjects = [];
    this.tilesX = 0;
    this.tilesY = 0;

    this.FRICTION = this.settingsData.FRICTION.get();
    this.SPRING_K = this.settingsData.SPRING_K.get();
    this.SPEEDUP_FACTOR = this.settingsData.SPEEDUP_FACTOR.get();
    this.MASS = this.settingsData.MASS.get();
    this.X_TILES =
      'maximized' === this.operationType ? 10 : this.settingsData.X_TILES.get();
    this.Y_TILES =
      'maximized' === this.operationType ? 10 : this.settingsData.Y_TILES.get();

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

      this.coeff = Array.from({ length: this.Y_TILES + 1 }, () => []);
      this.deformedObjects = Array.from({ length: this.Y_TILES + 1 }, () => []);

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

          this.coeff[y][x] = [
            tx1 * ty1,
            3 * tx2 * ty1,
            3 * tx3 * ty1,
            tx4 * ty1,
            3 * tx1 * ty2,
            9 * tx2 * ty2,
            9 * tx3 * ty2,
            3 * tx4 * ty2,
            3 * tx1 * ty3,
            9 * tx2 * ty3,
            9 * tx3 * ty3,
            3 * tx4 * ty3,
            tx1 * ty4,
            3 * tx2 * ty4,
            3 * tx3 * ty4,
            tx4 * ty4,
          ];

          this.deformedObjects[y][x] = [tx * this.width, ty * this.height];
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
  vfunc_modify_paint_volume(pv) {
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

    const actor = this.get_actor();
    if (actor) {
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
  on_end_event(actor) {
    this.ended = true;
  }

  /**
   * Move the effect.
   *
   * @param {Clutter.Actor} actor
   * @param {Clutter.ActorAllocation} allocation
   * @param {number} flags
   */
  on_move_event(actor, allocation, flags) {
    if (!actor || !this.wobblyModel) return;

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
    if (this.ended && (!this.timerId || !this.wobblyModel?.movement)) {
      this.destroy();
      return;
    }

    this.wobblyModel.step((msec - this.msecOld) / this.SPEEDUP_FACTOR);
    this.msecOld = msec;

    const obj = this.wobblyModel.objects;
    for (let y = 0; y <= this.Y_TILES; y++) {
      for (let x = 0; x <= this.X_TILES; x++) {
        const coeff = this.coeff[y][x];
        let dx = 0,
          dy = 0;
        for (let i = 0; i < 16; i++) {
          dx += coeff[i] * obj[i].x;
          dy += coeff[i] * obj[i].y;
        }
        this.deformedObjects[y][x][0] = dx;
        this.deformedObjects[y][x][1] = dy;
      }
    }

    const actor = this.actor;
    if (!actor) return;

    [this.actorX, this.actorY] = this.actor.get_position();
    if (
      (this.newX === this.actorX && this.newY === this.actorY) ||
      'move' !== this.operationType
    ) {
      this.invalidate();
    }
  }

  /**
   * Deform the vertex. Creates a wobbly effect.
   *
   * @param {number} w
   * @param {number} h
   * @param {Clutter.Vertex}
   */
  vfunc_deform_vertex(w, h, v) {
    if (!this.deformedObjects?.length) return;

    const ix = Math.min(Math.max(0, (v.tx * this.tilesX) >> 0), this.X_TILES);
    const iy = Math.min(Math.max(0, (v.ty * this.tilesY) >> 0), this.Y_TILES);

    const point = this.deformedObjects[iy]?.[ix];
    if (!point) return;

    const [x, y] = point;
    v.x = (x + this.deltaX) * (w / this.width);
    v.y = (y + this.deltaY) * (h / this.height);
  }
}
