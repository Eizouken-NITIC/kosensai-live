/** リポジトリ直下の config.json の形を表す。 */

export type Channel = {
  /** MediaMTX のパス名と一致させる。HLS の URL に入る。 */
  id: string;
  /** 来場者へ表示する唯一の文字列である。 */
  label: string;
  /** OBS が Listener として待つポートである。Ch4 は OBS 内で合成するため null になる。 */
  obsListenPort: number | null;
  srtLatencyUs: number | null;
  bitrateKbps: number;
};

export type Site = {
  /** 各ページの title・ロゴの代替テキスト・OS の再生通知に出る名前である。 */
  name: string;
  /** 配信サイトのホスト名である。 */
  domain: string;
  /** GitHub リポジトリの URL である。視聴ページにリンクを表示する。 */
  repository: string;
};

/** このリポジトリの外で運用されているサイトの所在を表す。iframe で埋め込み、リンクも表示する。 */
export type ExternalSite = {
  /** 画面に表示する表示名である。 */
  title: string;
  /** 初回の案内でこの欄を説明する文である。 */
  description: string;
  /** iframe に表示する URL である。 */
  embedUrl: string;
  /** 別タブで開く URL である。 */
  homeUrl: string;
};

/** 視聴ページを初めて開いた人へ出す案内のうち、運用ごとに変わる部分を表す。 */
export type Welcome = {
  /** 案内の最初に読ませる文である。 */
  description: string;
};

export type Signage = {
  /** ?ch= が付かない場合に映す Ch である。 */
  defaultChannel: string;
  /** QR の脇に表示する見出しと、その下の補足文である。 */
  inviteHeading: string;
  inviteNote: string;
};

/**
 * 再生の状態。
 *
 * - `connecting`  接続を試している最中であり、まだ失敗していない
 * - `playing`     再生している
 * - `idle`        プレイリストが 404 を返す。サーバーは応答しており、その Ch に publish が無い
 * - `waiting`     それ以外の原因で失敗している。サーバーの停止か端末の通信断で、区別は付かない
 * - `blocked`     ブラウザの自動再生ポリシーで止められた
 * - `unsupported` このブラウザでは HLS を再生できない
 *
 * `connecting` を分けているのは、Ch を切り替えた直後に失敗と断定しないためである。
 */
export type PlayerState = 'connecting' | 'playing' | 'idle' | 'waiting' | 'blocked' | 'unsupported';
