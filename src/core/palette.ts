/**
 * The palette, picked before any art was drawn (doc 17.3).
 *
 * Doc 17.1: bold, clashing, saturated. Purple next to orange next to green.
 * Doc 6.4.5: every band member owns a colour and it is used on the person, their
 * gear, their cables, their stack, their channel strip, and any sound the board
 * makes come out of them. That binding is what turns "which strip" into matching.
 */

export const CHANNEL_COLOURS = {
  /** Guitarist. Sodium-lamp orange. */
  guitar: { base: '#f0801c', light: '#ffc061', dark: '#8a3d05', ink: '#2a1400' },
  /** Drummer. Cheap disco purple. */
  drums: { base: '#a24ad0', light: '#d79bf5', dark: '#4a1d63', ink: '#1b0a24' },
  /** Bassist. Radioactive green. */
  bass: { base: '#57c94a', light: '#a6f08f', dark: '#1f5c1a', ink: '#0b2208' },
  /** Vocalist. Reserved for tier 2, defined now so nothing else claims red. */
  vocals: { base: '#e6425c', light: '#ff9aa6', dark: '#7a1226', ink: '#2b0610' },
} as const;

export type ChannelColour = { base: string; light: string; dark: string; ink: string };

export const UI = {
  /** Deep stage dark. Everything sits on this. */
  night: '#100c14',
  black: '#08060a',
  /** The desk itself: grubby industrial grey-brown. */
  deskFace: '#4b4239',
  deskFaceLit: '#5d5347',
  deskFaceDark: '#332d27',
  deskEdge: '#221d19',
  deskRail: '#6d6152',
  /** Hand-lettering and printed legends. */
  ink: '#1b1712',
  inkFaint: '#3b332a',
  chalk: '#e8e0cd',
  chalkDim: '#b3a893',
  /** Metal: fader caps, screws, knob skirts. */
  metal: '#8e8677',
  metalLit: '#c4bba6',
  metalDark: '#4a443a',
  /** Warnings and lamps. */
  lampOn: '#ffd23f',
  lampOff: '#5a4a22',
  danger: '#e33d4e',
  dangerDim: '#7d1f2a',
  good: '#67d46a',
  paper: '#e5d9a8',
  paperShade: '#c4b47e',
  stickyNote: '#f2e14c',
  stickyNoteShade: '#cbba2a',
  crowdDark: '#1d1826',
  crowdMid: '#2c2438',
  crowdLit: '#3d3350',
} as const;
