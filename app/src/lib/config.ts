/* 配信の定義を読み込む。
 *
 * config.json は hosts/obs/srt-urls.sh と hosts/server/scripts/preflight.sh も
 * 読むためリポジトリ直下にある。app/ の外を参照するのはこのファイルだけに閉じる。
 *
 * 名前付き import にすると、参照していない _comment がバンドルへ入らない。 */

import { channels as rawChannels, officialSite as rawOfficialSite } from '../../../config.json';
import type { Channel, OfficialSite } from './types';

export const channels: Channel[] = rawChannels;
export const officialSite: OfficialSite = rawOfficialSite;
