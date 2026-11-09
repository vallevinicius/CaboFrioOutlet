import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SettingsService } from './settings.service';
import { getDiscountedPrice } from './cart.service';
import { Product } from '../types/product';
import { Order } from '../types/order';
import {
  Consent,
  TrackItem,
  TrackedEvent,
  buildAddToCart,
  buildBeginCheckout,
  buildPurchase,
  buildViewItem,
  parseConsent,
} from '../utils/analytics-events';

const CONSENT_KEY = 'cabo-frio-outlet:cookie-consent';
// Os IDs vêm do admin e já são validados no servidor; aqui só entram em atributos/argumentos, nunca em código montado como texto.
const GA_ID_RE = /^G-[A-Z0-9]{4,20}$/;
const PIXEL_ID_RE = /^\d{8,20}$/;

interface AnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
}

function toItem(product: Product, quantity: number, size?: string): TrackItem {
  return {
    id: product.id,
    name: product.name,
    price: getDiscountedPrice(product),
    quantity,
    category: product.category,
    brand: product.brand,
    size,
  };
}

/**
 * GA4 e Pixel da Meta. Nada é carregado sem o visitante aceitar o aviso de
 * cookies (LGPD) e sem os IDs estarem configurados no admin.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private settings = inject(SettingsService);
  private router = inject(Router);

  private _consent = signal<Consent | null>(this.readConsent());
  readonly consent = this._consent.asReadonly();

  private gaId = computed(() => {
    const id = this.settings.settings().gaMeasurementId;
    return GA_ID_RE.test(id) ? id : '';
  });
  private pixelId = computed(() => {
    const id = this.settings.settings().metaPixelId;
    return PIXEL_ID_RE.test(id) ? id : '';
  });

  /** Há alguma ferramenta de medição configurada no admin. */
  readonly configured = computed(() => Boolean(this.gaId() || this.pixelId()));
  /** Mostrar o aviso: configurada e o visitante ainda não decidiu. */
  readonly needsConsent = computed(() => this.configured() && this._consent() === null);

  private gaLoaded = false;
  private pixelLoaded = false;

  constructor() {
    effect(() => {
      const granted = this._consent() === 'granted';
      const ga = this.gaId();
      const pixel = this.pixelId();
      untracked(() => {
        if (!granted) return;
        if (ga) this.loadGa(ga);
        if (pixel) this.loadPixel(pixel);
      });
    });

    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.pageView(e.urlAfterRedirects);
    });
  }

  accept(): void {
    this.setConsent('granted');
  }

  decline(): void {
    this.setConsent('denied');
  }

  /** Reabre o aviso (link "Preferências de cookies" no rodapé). */
  reset(): void {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    this._consent.set(null);
  }

  viewItem(product: Product): void {
    this.track(buildViewItem(toItem(product, 1)));
  }

  addToCart(product: Product, size: string): void {
    this.track(buildAddToCart(toItem(product, 1, size)));
  }

  beginCheckout(items: { product: Product; quantity: number; selectedSize: string }[]): void {
    if (items.length === 0) return;
    this.track(buildBeginCheckout(items.map((i) => toItem(i.product, i.quantity, i.selectedSize))));
  }

  purchase(order: Order): void {
    const items: TrackItem[] = order.items.map((i) => ({
      id: i.productId ?? i.id,
      name: i.productName,
      price: i.unitPrice,
      quantity: i.quantity,
      size: i.size,
    }));
    this.track(buildPurchase(order.id, items, order.total, order.shippingCost));
  }

  private track(event: TrackedEvent): void {
    const w = window as AnalyticsWindow;
    if (this.gaLoaded && w.gtag) w.gtag('event', event.ga.name, event.ga.params);
    if (this.pixelLoaded && w.fbq) w.fbq('track', event.meta.name, event.meta.params);
  }

  private pageView(url: string): void {
    const w = window as AnalyticsWindow;
    if (this.gaLoaded && w.gtag) w.gtag('event', 'page_view', { page_path: url, page_title: document.title });
    if (this.pixelLoaded && w.fbq) w.fbq('track', 'PageView');
  }

  private loadGa(id: string): void {
    if (this.gaLoaded) return;
    this.gaLoaded = true;
    const w = window as AnalyticsWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
    w.gtag('js', new Date());
    w.gtag('config', id, { send_page_view: false });
    this.pageView(this.router.url);
  }

  private loadPixel(id: string): void {
    if (this.pixelLoaded) return;
    this.pixelLoaded = true;
    const w = window as AnalyticsWindow;
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
        else fbq.queue!.push(args);
      } as NonNullable<AnalyticsWindow['fbq']>;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      w.fbq = fbq;
      w._fbq = fbq;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
    w.fbq('init', id);
    this.pageView(this.router.url);
  }

  private setConsent(value: Consent): void {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    this._consent.set(value);
  }

  private readConsent(): Consent | null {
    try {
      return parseConsent(localStorage.getItem(CONSENT_KEY));
    } catch {
      return null;
    }
  }
}
