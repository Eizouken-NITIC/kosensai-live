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

export type Site = {
  /** 各ページの title・ロゴの代替テキスト・OS の再生通知に出る名前。 */
  name: string;
  /** 配信サイトのホスト名。 */
  domain: string;
};

/** このリポジトリの外で運用されているサイトの所在。iframe で埋め込み、リンクも出す。 */
export type ExternalSite = {
  /** 画面に出す表示名。 */
  title: string;
  /** iframe に出す URL。 */
  embedUrl: string;
  /** 別タブで開く URL。 */
  homeUrl: string;
};

export type Signage = {
  /** ?ch= が付かない場合に映す Ch。 */
  defaultChannel: string;
  /** QR の脇に出す見出しと、その下の補足。 */
  inviteHeading: string;
  inviteNote: string;
};

/**
 * 再生の状態。
 *
 * - `connecting`  接続を試している最中。まだ失敗していない
 * - `playing`     再生中
 * - `idle`        プレイリストが 404。サーバーは応答しており、その Ch に publish が無い
 * - `waiting`     それ以外の失敗。サーバーの停止か端末の通信断で、区別は付かない
 * - `blocked`     ブラウザの自動再生ポリシーで止められた
 * - `unsupported` HLS を再生できないブラウザ
 *
 * `connecting` を分けているのは、Ch を切り替えた直後に失敗と断定しないため。
 */
export type PlayerState = 'connecting' | 'playing' | 'idle' | 'waiting' | 'blocked' | 'unsupported';
