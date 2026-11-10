/**
 * hardwareService.js
 * ------------------------------------------------------------------
 * The browser NEVER talks to the box. The box talks to the backend (docs/DEVICE_API.md);
 * this module only reads what the backend knows the box reported. If a box has not reported,
 * nothing here pretends it is connected.
 * ------------------------------------------------------------------
 */
import { getBoxes } from './boxService';

export async function getCabinetStatus(patientId) {
  const boxes = await getBoxes();
  const mine = patientId ? boxes.filter((b) => b.patientId === patientId) : boxes;
  return { connected: mine.some((b) => b.connection.state === 'online'), boxes: mine };
}

export const CONNECTION_LABEL = {
  online: 'Online', offline: 'Offline', powered_off: 'Switched off', awaiting_first_connection: 'Awaiting first connection', unpaired: 'Not paired',
};
export const CONNECTION_TONE = { online: 'success', offline: 'danger', powered_off: 'neutral', awaiting_first_connection: 'warning', unpaired: 'neutral' };
