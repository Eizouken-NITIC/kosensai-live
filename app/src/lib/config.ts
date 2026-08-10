/* config.json はシェルスクリプトと tools も読むためリポジトリ直下にある。
 *
 * 名前付き import にすると、参照していない _comment がバンドルへ入らない。 */

import {
  domain as rawDomain,
  channels as rawChannels,
  externalSite as rawExternalSite,
  signage as rawSignage,
} from '../../../config.json';
import type { Channel, ExternalSite, Signage } from './types';

export const domain: string = rawDomain;
export const channels: Channel[] = rawChannels;
export const externalSite: ExternalSite = rawExternalSite;
export const signage: Signage = rawSignage;
