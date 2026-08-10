/* 初めて視聴ページを開いた人へ、実際の要素を指しながら画面の読み方を伝える。
 *
 * どのステップも実在する要素を指す。driver.js は要素を指定しないステップに対して
 * 画面の中央へ大きさの無い切り抜きを作るため、何も無い場所が照らされることになる。 */

import { externalSite, welcome } from './config';

const STORE_KEY = 'welcomeSeen';

/* driver.js は暗がりの色と濃さを CSS ではなく設定値で受け取るため、覆いと同じ濃さを
   ここに書く。CSS の --scrim-2 と同じ値である。 */
const OVERLAY_COLOR = '#000';
const OVERLAY_OPACITY = 0.7;
/* 面を角丸で切らない画面なので、切り抜きも角を落とさない。 */
const STAGE_RADIUS = 0;
const STAGE_PADDING = 6;

function seen(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    // 読めない環境では初めての来場者へ確実に届くほうを選び、毎回出す
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORE_KEY, '1');
  } catch {
    /* ローカルストレージ無効時 */
  }
}

export async function startOnboarding(): Promise<void> {
  if (seen()) return;

  // media-chrome が要素を組み立てるまで、コントロールバーは大きさを持たない。
  await customElements.whenDefined('media-mute-button');

  const { driver } = await import('driver.js');

  const tour = driver({
    popoverClass: 'onboarding',
    overlayColor: OVERLAY_COLOR,
    overlayOpacity: OVERLAY_OPACITY,
    stageRadius: STAGE_RADIUS,
    stagePadding: STAGE_PADDING,
    showProgress: true,
    progressText: '{{current}}/{{total}}',
    nextBtnText: '次へ',
    prevBtnText: '戻る',
    doneBtnText: '視聴をはじめる',
    onDestroyed: () => {
      document.documentElement.classList.remove('tour');
      markSeen();
    },
    steps: [
      {
        element: '.topbar .logo',
        popover: {
          title: welcome.title,
          description: welcome.description,
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.topbar nav',
        popover: {
          title: '会場の切り替え',
          description:
            '上部のタブを選択すると、配信する会場を切り替えられます。見たいステージや全体の様子など、お好きなチャンネルをお選びください。',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: 'media-mute-button',
        popover: {
          title: '音声を出すにはここを押す',
          description:
            'ブラウザの仕様により、最初は消音（ミュート）で再生が始まります。このボタンを押して消音を解除し、隣のつまみで音量を調整してください。',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '.panel',
        popover: {
          title: externalSite.title,
          description: externalSite.description,
        },
      },
    ],
  });

  // 幅 1000px 以上では操作が無いと上端のバーが消えるため、案内の間だけ出したままにする
  document.documentElement.classList.add('tour');
  tour.drive();
}
