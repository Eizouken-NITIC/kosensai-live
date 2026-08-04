import{M as r}from"./BDgEbnN0.js";import{a as t,g as d,s as m,b as n,G as l}from"./C2UIz1tz.js";import{t as s}from"./BvMjJdGg.js";const E=`<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="m6 21 15-9L6 3v18Z"/>
</svg>`,A=`<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="M6 20h4V4H6v16Zm8-16v16h4V4h-4Z"/>
</svg>`;function c(a){return`
    <style>
      :host([${t.MEDIA_PAUSED}]) slot[name=pause],
      :host(:not([${t.MEDIA_PAUSED}])) slot[name=play] {
        display: none !important;
      }

      :host([${t.MEDIA_PAUSED}]) slot[name=tooltip-pause],
      :host(:not([${t.MEDIA_PAUSED}])) slot[name=tooltip-play] {
        display: none;
      }
    </style>

    <slot name="icon">
      <slot name="play">${E}</slot>
      <slot name="pause">${A}</slot>
    </slot>
  `}function b(){return`
    <slot name="tooltip-play">${s("Play")}</slot>
    <slot name="tooltip-pause">${s("Pause")}</slot>
  `}const i=a=>{const e=a.mediaPaused?s("play"):s("pause");a.setAttribute("aria-label",e)};class o extends r{static get observedAttributes(){return[...super.observedAttributes,t.MEDIA_PAUSED,t.MEDIA_ENDED]}connectedCallback(){super.connectedCallback(),i(this)}attributeChangedCallback(e,u,p){super.attributeChangedCallback(e,u,p),(e===t.MEDIA_PAUSED||e===t.MEDIA_LANG)&&i(this)}get mediaPaused(){return d(this,t.MEDIA_PAUSED)}set mediaPaused(e){m(this,t.MEDIA_PAUSED,e)}handleClick(){const e=this.mediaPaused?n.MEDIA_PLAY_REQUEST:n.MEDIA_PAUSE_REQUEST;this.dispatchEvent(new l.CustomEvent(e,{composed:!0,bubbles:!0}))}}o.getSlotTemplateHTML=c;o.getTooltipContentHTML=b;l.customElements.get("media-play-button")||l.customElements.define("media-play-button",o);var _=o;export{o as MediaPlayButton,_ as default};
