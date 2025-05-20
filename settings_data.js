/*
 * gnome-wobbly-windows for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/kyleabaker/gnome-wobbly-windows>
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

export class SettingsData {
    constructor(settings) {
        this.FRICTION = {
            key: 'friction',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.SPRING_K = {
            key: 'spring-k',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.SPEEDUP_FACTOR = {
            key: 'speedup-factor-divider',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
        
        this.MASS = {
            key: 'mass',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.X_TILES = {
            key: 'x-tiles',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.Y_TILES = {
            key: 'y-tiles',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.MAXIMIZE_EFFECT = {
            key: 'maximize-effect',
            get: function () { return settings.get_boolean(this.key); },
            set: function (v) { settings.set_boolean(this.key, v); }
        };
    
        this.RESIZE_EFFECT = {
            key: 'resize-effect',
            get: function () { return settings.get_boolean(this.key); },
            set: function (v) { settings.set_boolean(this.key, v); }
        };
    }
}
