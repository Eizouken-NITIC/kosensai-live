/** リポジトリ直下の config.json の形。 */

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

/** このリポジトリの外で運用されているサイトの所在。iframe で埋め込み、リンクも出す。 */
export type ExternalSite = {
  /** iframe に出す URL。/events が公開されたらここを向ける。 */
  embedUrl: string;
  /** 別タブで開く URL。 */
  homeUrl: string;
};

/**
 * 再生の状態。
 *
 * - `connecting`  接続を試している最中。まだ失敗していない
 * - `playing`     再生中
 * - `waiting`     取得に失敗した。その Ch はまだ配信されていない
 * - `blocked`     ブラウザの自動再生ポリシーで止められた
 * - `unsupported` HLS を再生できないブラウザ
 *
 * `connecting` と `waiting` を分けているのは、Ch を切り替えた直後に
 * 配信されていないと断定してしまわないため。
 */
export type PlayerState = 'connecting' | 'playing' | 'waiting' | 'blocked' | 'unsupported';
