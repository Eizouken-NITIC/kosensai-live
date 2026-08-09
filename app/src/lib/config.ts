/* config.json は hosts/obs/srt-urls.sh と hosts/server/scripts/preflight.sh も
 * 読むためリポジトリ直下にある。
 *
 * 名前付き import にすると、参照していない _comment がバンドルへ入らない。 */

import { channels as rawChannels, externalSite as rawExternalSite } from '../../../config.json';
import type { Channel, ExternalSite } from './types';

export const channels: Channel[] = rawChannels;
export const externalSite: ExternalSite = rawExternalSite;
