import{M as v}from"./BDgEbnN0.js";import{a as i,g as c,s as m,G as l,b as E}from"./C2UIz1tz.js";import{t as s}from"./BvMjJdGg.js";const{MEDIA_TIME_IS_LIVE:r,MEDIA_PAUSED:o}=i,{MEDIA_SEEK_TO_LIVE_REQUEST:h,MEDIA_PLAY_REQUEST:I}=E,A='<svg viewBox="0 0 6 12" aria-hidden="true"><circle cx="3" cy="6" r="2"></circle></svg>';function _(t){return`
    <style>
      :host { --media-tooltip-display: none; }
      
      slot[name=indicator] > *,
      :host ::slotted([slot=indicator]) {
        
        min-width: auto;
        fill: var(--media-live-button-icon-color, rgb(140, 140, 140));
        color: var(--media-live-button-icon-color, rgb(140, 140, 140));
      }

      :host([${r}]:not([${o}])) slot[name=indicator] > *,
      :host([${r}]:not([${o}])) ::slotted([slot=indicator]) {
        fill: var(--media-live-button-indicator-color, rgb(255, 0, 0));
        color: var(--media-live-button-indicator-color, rgb(255, 0, 0));
      }

      :host([${r}]:not([${o}])) {
        cursor: var(--media-cursor, not-allowed);
      }

      slot[name=text]{
        text-transform: uppercase;
      }

    </style>

    <slot name="indicator">${A}</slot>
    
    <slot name="spacer">&nbsp;</slot><slot name="text">${s("live")}</slot>
  `}const b=t=>{var e;const a=t.mediaPaused||!t.mediaTimeIsLive,n=a?s("seek to live"):s("playing live");t.setAttribute("aria-label",n);const u=(e=t.shadowRoot)==null?void 0:e.querySelector('slot[name="text"]');u&&(u.textContent=s("live")),a?t.removeAttribute("aria-disabled"):t.setAttribute("aria-disabled","true")};class d extends v{static get observedAttributes(){return[...super.observedAttributes,r,o]}connectedCallback(){super.connectedCallback(),b(this)}attributeChangedCallback(e,a,n){super.attributeChangedCallback(e,a,n),b(this)}get mediaPaused(){return c(this,i.MEDIA_PAUSED)}set mediaPaused(e){m(this,i.MEDIA_PAUSED,e)}get mediaTimeIsLive(){return c(this,i.MEDIA_TIME_IS_LIVE)}set mediaTimeIsLive(e){m(this,i.MEDIA_TIME_IS_LIVE,e)}handleClick(){!this.mediaPaused&&this.mediaTimeIsLive||(this.dispatchEvent(new l.CustomEvent(h,{composed:!0,bubbles:!0})),this.hasAttribute(o)&&this.dispatchEvent(new l.CustomEvent(I,{composed:!0,bubbles:!0})))}}d.getSlotTemplateHTML=_;l.customElements.get("media-live-button")||l.customElements.define("media-live-button",d);var T=d;export{T as default};
