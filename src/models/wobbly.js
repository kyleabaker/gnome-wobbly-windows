/*
 * Copyright © 2005 Novell, Inc.
 * Copyright © 2022 Mauro Pepe
 * Copyright © 2025 Kyle Baker
 *
 * Permission to use, copy, modify, distribute, and sell this software
 * and its documentation for any purpose is hereby granted without
 * fee, provided that the above copyright notice appear in all copies
 * and that both that copyright notice and this permission notice
 * appear in supporting documentation, and that the name of
 * Novell, Inc. not be used in advertising or publicity pertaining to
 * distribution of the software without specific, written prior permission.
 * Novell, Inc. makes no representations about the suitability of this
 * software for any purpose. It is provided "as is" without express or
 * implied warranty.
 *
 * NOVELL, INC. DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE,
 * INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS, IN
 * NO EVENT SHALL NOVELL, INC. BE LIABLE FOR ANY SPECIAL, INDIRECT OR
 * CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION
 * WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Author: David Reveman <davidr@novell.com>
 *         Scott Moreau <oreaus@gmail.com>
 *         Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 *         Kyle Baker <https://github.com/kyleabaker/gnome-wobbly-windows>
 *
 * Spring model implemented by Kristian Hogsberg.
 */
'use strict';

export class WobblyModel {
  constructor(config) {
    this.GRID_WIDTH = 4;
    this.GRID_HEIGHT = 4;
    this.INTENSITY = 0.8;

    const totalPoints = this.GRID_WIDTH * this.GRID_HEIGHT;
    this.objects = Array.from({ length: totalPoints }, () =>
      this._createObject()
    );
    this.springs = [];
    this.movement = false;
    this.immobileObject = null;

    this.width = config.sizeX;
    this.height = config.sizeY;
    this.friction = config.friction;
    this.springK = config.springK * 0.5;
    this.mass = 100 - config.mass;

    this._initializeObjectPositions();
    this.initSprings();
  }

  dispose() {
    this.objects = null;
    this.springs = null;
  }

  _createObject() {
    return {
      forceX: 0,
      forceY: 0,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      immobile: false,
    };
  }

  _initializeObjectPositions() {
    const gw = this.GRID_WIDTH - 1;
    const gh = this.GRID_HEIGHT - 1;
    let i = 0;

    for (let gridY = 0; gridY < this.GRID_HEIGHT; gridY++) {
      for (let gridX = 0; gridX < this.GRID_WIDTH; gridX++) {
        const object = this.objects[i++];
        object.x = (gridX * this.width) / gw;
        object.y = (gridY * this.height) / gh;
      }
    }
  }

  initSprings() {
    let i = 0;
    const hpad = this.width / (this.GRID_WIDTH - 1);
    const vpad = this.height / (this.GRID_HEIGHT - 1);

    for (let gridY = 0; gridY < this.GRID_HEIGHT; gridY++) {
      for (let gridX = 0; gridX < this.GRID_WIDTH; gridX++) {
        if (gridX > 0) {
          this.springs.push({
            a: this.objects[i - 1],
            b: this.objects[i],
            offsetX: hpad,
            offsetY: 0,
          });
        }
        if (gridY > 0) {
          this.springs.push({
            a: this.objects[i - this.GRID_WIDTH],
            b: this.objects[i],
            offsetX: 0,
            offsetY: vpad,
          });
        }
        i++;
      }
    }
  }

  nearestObject(x, y) {
    let minDistance = Infinity;
    let result = null;

    for (const object of this.objects) {
      const dx = Math.abs(object.x - x);
      const dy = Math.abs(object.y - y);
      const distance = dx + dy;

      if (distance < minDistance) {
        minDistance = distance;
        result = object;
      }
    }

    return result;
  }

  grab(x, y) {
    this.immobileObject = this.nearestObject(x, y);
    if (this.immobileObject) this.immobileObject.immobile = true;
  }

  maximize() {
    this.immobileObject = null;

    const topLeft = this.nearestObject(0, 0);
    const topRight = this.nearestObject(this.width, 0);
    const bottomLeft = this.nearestObject(0, this.height);
    const bottomRight = this.nearestObject(this.width, this.height);

    for (const obj of [topLeft, topRight, bottomLeft, bottomRight]) {
      if (obj) obj.immobile = true;
    }

    for (const spring of this.springs) {
      if ([topLeft, topRight, bottomLeft, bottomRight].includes(spring.a)) {
        spring.b.velocityX -= spring.offsetX * this.INTENSITY;
        spring.b.velocityY -= spring.offsetY * this.INTENSITY;
      } else if (
        [topLeft, topRight, bottomLeft, bottomRight].includes(spring.b)
      ) {
        spring.a.velocityX -= spring.offsetX * this.INTENSITY;
        spring.a.velocityY -= spring.offsetY * this.INTENSITY;
      }
    }

    this.step(0);
  }

  unmaximize() {
    this.immobileObject = this.nearestObject(this.width / 2, this.height / 2);
    if (this.immobileObject) this.immobileObject.immobile = true;

    for (const spring of this.springs) {
      if (spring.a === this.immobileObject) {
        spring.b.velocityX -= spring.offsetX * this.INTENSITY;
        spring.b.velocityY -= spring.offsetY * this.INTENSITY;
      } else if (spring.b === this.immobileObject) {
        spring.a.velocityX -= spring.offsetX * this.INTENSITY;
        spring.a.velocityY -= spring.offsetY * this.INTENSITY;
      }
    }

    this.step(0);
  }

  step(steps) {
    let movementStep = false;

    for (let j = steps; j >= 0; --j) {
      for (const spring of this.springs) {
        const fx = this.springK * (spring.b.x - spring.a.x - spring.offsetX);
        spring.a.forceX += fx;
        spring.b.forceX -= fx;

        const fy = this.springK * (spring.b.y - spring.a.y - spring.offsetY);
        spring.a.forceY += fy;
        spring.b.forceY -= fy;
      }

      for (const object of this.objects) {
        if (!object.immobile) {
          object.forceX -= this.friction * object.velocityX;
          object.forceY -= this.friction * object.velocityY;

          object.velocityX += object.forceX / this.mass;
          object.velocityY += object.forceY / this.mass;

          object.x += object.velocityX;
          object.y += object.velocityY;

          if (Math.abs(object.forceX) > 1 || Math.abs(object.forceY) > 1) {
            movementStep = true;
          }

          object.forceX = 0;
          object.forceY = 0;
        }
      }
    }

    this.movement = movementStep;
  }

  move(deltaX, deltaY) {
    if (this.immobileObject) {
      this.immobileObject.x += deltaX;
      this.immobileObject.y += deltaY;
    }
  }
}
