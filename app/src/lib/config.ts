/* config.json はシェルスクリプトと tools も読むためリポジトリ直下にある。
 *
 * 名前付き import にすると、参照していない _comment がバンドルへ入らない。 */

import {
  site as rawSite,
  channels as rawChannels,
  externalSite as rawExternalSite,
  signage as rawSignage,
  welcome as rawWelcome,
} from '../../../config.json';
import type { Channel, ExternalSite, Signage, Site, Welcome } from './types';

export const site: Site = rawSite;
export const channels: Channel[] = rawChannels;
export const externalSite: ExternalSite = rawExternalSite;
export const signage: Signage = rawSignage;
export const welcome: Welcome = rawWelcome;
