/*
 * GNOME Wobbly Windows for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createSettingsData } from './src/settings/data.js';

/**
 * Preferences window
 *
 * @name Prefs
 * @description Preferences window implementation for GNOME Wobbly Windows
 */
export default class Prefs extends ExtensionPreferences {
  /**
   * Fill preferences window
   *
   * @param {Gtk.Window} window
   */
  fillPreferencesWindow(window) {
    const settingsData = createSettingsData(this.getSettings());

    const width = 750;
    const height = 580;
    window.set_default_size(width, height);

    const page = Adw.PreferencesPage.new();
    page.set_title('GNOME Wobbly Windows');

    // Settings group 1: Friction, Spring, Speedup Factor, Mass
    const group1 = Adw.PreferencesGroup.new();
    this.frictionSlider = this.addSlider(
      group1,
      'Friction',
      settingsData.FRICTION,
      1.0,
      10.0,
      1
    );
    this.springKSlider = this.addSlider(
      group1,
      'Spring',
      settingsData.SPRING_K,
      1.0,
      10.0,
      1
    );
    this.speedupFactor = this.addSlider(
      group1,
      'Speedup Factor',
      settingsData.SPEEDUP_FACTOR,
      2.0,
      40.0,
      1
    );
    this.massSlider = this.addSlider(
      group1,
      'Mass',
      settingsData.MASS,
      20.0,
      80.0,
      0
    );
    page.add(group1);

    // Settings group 2: X Tiles, Y Tiles, Maximize effect, Resize effect
    const group2 = Adw.PreferencesGroup.new();
    this.xTilesSlider = this.addSlider(
      group2,
      'X Tiles',
      settingsData.X_TILES,
      3.0,
      20.0,
      0
    );
    this.yTilesSlider = this.addSlider(
      group2,
      'Y Tiles',
      settingsData.Y_TILES,
      3.0,
      20.0,
      0
    );
    this.maximizeEffectSwitch = this.addBooleanSwitch(
      group2,
      'Maximize effect',
      settingsData.MAXIMIZE_EFFECT
    );
    this.resizeEffectSwitch = this.addBooleanSwitch(
      group2,
      'Resize effect',
      settingsData.RESIZE_EFFECT
    );
    page.add(group2);

    // Reset button
    this.addResetButton(window, settingsData);

    window.add(page);
  }

  /**
   * Add reset button
   *
   * @param {Gtk.Window} window
   * @param {Object} settingsData
   */
  addResetButton(window, settingsData) {
    const button = new Gtk.Button({ vexpand: true, valign: Gtk.Align.END });
    button.set_icon_name('edit-clear');

    button.connect('clicked', () => {
      settingsData.FRICTION.set(3.5);
      settingsData.SPRING_K.set(3.8);
      settingsData.SPEEDUP_FACTOR.set(12.0);
      settingsData.MASS.set(70.0);
      settingsData.X_TILES.set(6.0);
      settingsData.Y_TILES.set(6.0);
      settingsData.MAXIMIZE_EFFECT.set(true);
      settingsData.RESIZE_EFFECT.set(false);

      this.frictionSlider.set_value(settingsData.FRICTION.get());
      this.springKSlider.set_value(settingsData.SPRING_K.get());
      this.speedupFactor.set_value(settingsData.SPEEDUP_FACTOR.get());
      this.massSlider.set_value(settingsData.MASS.get());
      this.xTilesSlider.set_value(settingsData.X_TILES.get());
      this.yTilesSlider.set_value(settingsData.Y_TILES.get());
      this.maximizeEffectSwitch.set_active(settingsData.MAXIMIZE_EFFECT.get());
      this.resizeEffectSwitch.set_active(settingsData.RESIZE_EFFECT.get());
    });

    const header = this.findWidgetByType(window.get_content(), Adw.HeaderBar);
    if (header) {
      header.pack_start(button);
    }

    return button;
  }

  /**
   * Add slider
   *
   * @param {Adw.PreferencesGroup} group
   * @param {string} labelText
   * @param {Object} settingsData
   * @param {number} lower
   * @param {number} upper
   * @param {number} decimalDigits
   */
  addSlider(group, labelText, settingsData, lower, upper, decimalDigits) {
    const scale = new Gtk.Scale({
      digits: decimalDigits,
      adjustment: new Gtk.Adjustment({ lower: lower, upper: upper }),
      value_pos: Gtk.PositionType.RIGHT,
      hexpand: true,
      halign: Gtk.Align.END,
    });
    scale.set_draw_value(true);
    scale.set_value(settingsData.get());
    scale.connect('value-changed', (sw) => {
      const newval = sw.get_value();
      if (newval != settingsData.get()) {
        settingsData.set(newval);
      }
    });
    scale.set_size_request(400, 15);

    const row = Adw.ActionRow.new();
    row.set_title(labelText);
    row.add_suffix(scale);
    group.add(row);

    return scale;
  }

  /**
   * Add boolean switch
   *
   * @param {Adw.PreferencesGroup} group
   * @param {string} labelText
   * @param {Object} settingsData
   */
  addBooleanSwitch(group, labelText, settingsData) {
    const gtkSwitch = new Gtk.Switch({ hexpand: true, halign: Gtk.Align.END });
    gtkSwitch.set_active(settingsData.get());
    gtkSwitch.set_valign(Gtk.Align.CENTER);
    gtkSwitch.connect('state-set', (sw) => {
      const newval = sw.get_active();
      if (newval != settingsData.get()) {
        settingsData.set(newval);
      }
    });

    const row = Adw.ActionRow.new();
    row.set_title(labelText);
    row.add_suffix(gtkSwitch);
    group.add(row);

    return gtkSwitch;
  }

  /**
   * Find widget by type
   *
   * @param {object} parent
   * @param {object} type
   */
  findWidgetByType(parent, type) {
    for (const child of [...parent]) {
      if (child instanceof type) return child;

      const match = this.findWidgetByType(child, type);
      if (match) return match;
    }
    return null;
  }
}
