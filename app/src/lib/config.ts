/* 配信の定義を読み込む。
 *
 * config.json はリポジトリ直下にある。app/ だけでなく hosts/obs/srt-urls.sh と
 * hosts/server/scripts/preflight.sh も同じファイルを読むため、app/ の内側には
 * 置けない。app/ の外を参照するのはこのファイルだけに閉じてある。
 *
 * 名前付き import にすることで、参照していないキー（_comment）がバンドルへ
 * 入らない。既定 import で受けるとオブジェクト全体が残る。 */

import { channels as rawChannels, officialSite as rawOfficialSite } from '../../../config.json';
import type { Channel, OfficialSite } from './types';

export const channels: Channel[] = rawChannels;
export const officialSite: OfficialSite = rawOfficialSite;
