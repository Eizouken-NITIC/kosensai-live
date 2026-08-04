/** web/config.json（= static/config.json）の形。 */

export type Channel = {
  /** MediaMTX のパス名と一致させる。HLS の URL に入る。 */
  id: string;
  /** 来場者に見せる唯一の文字列。 */
  label: string;
  /** OBS が Listener として待つポート。Ch4 は OBS 内で合成するので null。 */
  obsListenPort: number | null;
  srtLatencyUs: number | null;
  bitrateKbps: number;
  /** 映像の出どころ。srt-urls.sh の出力に使う。 */
  source: string;
};

export type OfficialSite = {
  /** 別タブで開くリンク先。 */
  homeUrl: string;
  /** iframe に出す URL。/events が公開されたらここを向ける。 */
  embedUrl: string;
  label?: string;
};

export type SiteConfig = {
  channels: Channel[];
  officialSite: OfficialSite;
};

/** 再生の状態。connecting と waiting を分けているのは、Ch を切り替えた直後に
 *  「まだ配信が始まっていない」と断定してしまわないため。 */
export type PlayerState = 'connecting' | 'playing' | 'waiting' | 'blocked' | 'unsupported';
